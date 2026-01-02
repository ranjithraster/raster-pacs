/**
 * WebGL Volume Renderer
 * GPU-accelerated 3D volume rendering using ray-marching.
 * Supports VR, MIP, MinIP, and Surface rendering modes.
 */

class WebGLVolumeRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.gl = null;
        this.program = null;
        this.volumeTexture = null;
        this.transferFunctionTexture = null;
        this.isInitialized = false;

        // Volume state
        this.volumeDimensions = { width: 0, height: 0, depth: 0 };
        this.volumeSpacing = { x: 1, y: 1, z: 1 };

        // Camera state
        this.rotation = { x: 0, y: 0 };
        this.zoom = 1.0;
        this.pan = { x: 0, y: 0 };

        // Render settings
        this.renderMode = 'VR'; // VR, MIP, MinIP, Surface
        this.sampleDistance = 1.0;
        this.brightness = 1.0;
        this.isoValue = 300; // For surface rendering (HU)

        // Transfer function (default CT bone-like)
        this.transferFunction = {
            opacityPoints: [
                { hu: -1024, opacity: 0 },
                { hu: -500, opacity: 0 },
                { hu: 0, opacity: 0.1 },
                { hu: 500, opacity: 0.4 },
                { hu: 1000, opacity: 0.8 },
                { hu: 3071, opacity: 1.0 }
            ],
            colorPoints: [
                { hu: -1024, r: 0, g: 0, b: 0 },
                { hu: -500, r: 0, g: 0, b: 0 },
                { hu: 0, r: 255, g: 200, b: 180 },
                { hu: 500, r: 255, g: 230, b: 200 },
                { hu: 1000, r: 255, g: 255, b: 240 },
                { hu: 3071, r: 255, g: 255, b: 255 }
            ]
        };

        // GPU capabilities
        this.maxTextureSize = 0;
        this.max3DTextureSize = 0;
    }

    /**
     * Initialize WebGL context and shaders
     */
    async initialize() {
        // Get WebGL2 context (required for 3D textures)
        this.gl = this.canvas.getContext('webgl2', {
            antialias: true,
            preserveDrawingBuffer: true,
            alpha: false  // Prevent transparency issues
        });

        if (!this.gl) {
            throw new Error('WebGL2 not supported. Please use a modern browser.');
        }

        // Check GPU capabilities
        this.checkCapabilities();

        // Create shader program
        this.program = this.createShaderProgram();

        // Create geometry (fullscreen quad)
        this.createGeometry();

        // Create transfer function texture
        this.updateTransferFunctionTexture();

        this.isInitialized = true;
        console.log('WebGL Volume Renderer initialized');
        console.log(`Max 3D texture size: ${this.max3DTextureSize}`);

        return true;
    }

    /**
     * Check WebGL capabilities
     */
    checkCapabilities() {
        const gl = this.gl;

        this.maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);
        this.max3DTextureSize = gl.getParameter(gl.MAX_3D_TEXTURE_SIZE);

        console.log('WebGL Capabilities:', {
            maxTextureSize: this.maxTextureSize,
            max3DTextureSize: this.max3DTextureSize,
            vendor: gl.getParameter(gl.VENDOR),
            renderer: gl.getParameter(gl.RENDERER)
        });

        if (this.max3DTextureSize < 256) {
            throw new Error('GPU does not support sufficient 3D texture size');
        }
    }

    /**
     * Check if volume needs downsampling
     */
    needsDownsampling(width, height, depth) {
        const maxDim = Math.max(width, height, depth);
        return maxDim > this.max3DTextureSize;
    }

    /**
     * Get recommended max dimension based on GPU
     */
    getRecommendedMaxDimension() {
        // Use 75% of max to leave room for other textures
        return Math.min(this.max3DTextureSize, 512);
    }

    /**
     * Create fullscreen quad geometry
     */
    createGeometry() {
        const gl = this.gl;

        // Fullscreen quad vertices
        const vertices = new Float32Array([
            -1, -1,
             1, -1,
            -1,  1,
             1,  1
        ]);

        const vbo = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
        gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

        const posLoc = gl.getAttribLocation(this.program, 'aPosition');
        gl.enableVertexAttribArray(posLoc);
        gl.vertexAttribPointer(posLoc, 2, gl.FLOAT, false, 0, 0);
    }

    /**
     * Create shader program
     */
    createShaderProgram() {
        const gl = this.gl;

        const vertexShader = this.compileShader(gl.VERTEX_SHADER, this.getVertexShaderSource());
        const fragmentShader = this.compileShader(gl.FRAGMENT_SHADER, this.getFragmentShaderSource());

        const program = gl.createProgram();
        gl.attachShader(program, vertexShader);
        gl.attachShader(program, fragmentShader);
        gl.linkProgram(program);

        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error('Shader program failed to link: ' + gl.getProgramInfoLog(program));
        }

        gl.useProgram(program);
        return program;
    }

    /**
     * Compile a shader
     */
    compileShader(type, source) {
        const gl = this.gl;
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);

        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            const info = gl.getShaderInfoLog(shader);
            gl.deleteShader(shader);
            throw new Error('Shader compilation failed: ' + info);
        }

        return shader;
    }

    /**
     * Vertex shader source
     */
    getVertexShaderSource() {
        return `#version 300 es
        in vec2 aPosition;
        out vec2 vUV;
        
        void main() {
            vUV = aPosition * 0.5 + 0.5;
            gl_Position = vec4(aPosition, 0.0, 1.0);
        }
        `;
    }

    /**
     * Fragment shader source with ray-marching
     */
    getFragmentShaderSource() {
        return `#version 300 es
        precision highp float;
        precision highp sampler3D;
        
        in vec2 vUV;
        out vec4 fragColor;
        
        uniform sampler3D uVolume;
        uniform sampler2D uTransferFunction;
        uniform vec3 uVolumeDimensions;
        uniform int uRenderMode; // 0=VR, 1=MIP, 2=MinIP, 3=Surface
        uniform float uSampleDistance;
        uniform float uBrightness;
        uniform float uIsoValue; // Normalized 0-1
        uniform float uRotationX;
        uniform float uRotationY;
        uniform float uZoom;
        
        // Rotate a point around X axis
        vec3 rotateX(vec3 p, float angle) {
            float c = cos(angle);
            float s = sin(angle);
            return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
        }
        
        // Rotate a point around Y axis
        vec3 rotateY(vec3 p, float angle) {
            float c = cos(angle);
            float s = sin(angle);
            return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
        }
        
        // Ray-box intersection for unit cube centered at origin
        vec2 intersectBox(vec3 orig, vec3 dir) {
            vec3 boxMin = vec3(-0.5);
            vec3 boxMax = vec3(0.5);
            
            vec3 tMin = (boxMin - orig) / dir;
            vec3 tMax = (boxMax - orig) / dir;
            
            vec3 t1 = min(tMin, tMax);
            vec3 t2 = max(tMin, tMax);
            
            float tNear = max(max(t1.x, t1.y), t1.z);
            float tFar = min(min(t2.x, t2.y), t2.z);
            
            return vec2(tNear, tFar);
        }
        
        // Sample volume at position (in [-0.5, 0.5] coordinates)
        float sampleVolume(vec3 pos) {
            vec3 texCoord = pos + 0.5; // Convert to [0, 1]
            // Clamp to valid range
            texCoord = clamp(texCoord, 0.001, 0.999);
            return texture(uVolume, texCoord).r;
        }
        
        // Get color and opacity from transfer function
        vec4 applyTransferFunction(float value) {
            return texture(uTransferFunction, vec2(clamp(value, 0.0, 1.0), 0.5));
        }
        
        // Compute gradient for shading
        vec3 computeGradient(vec3 pos) {
            float d = 0.01;
            float dx = sampleVolume(pos + vec3(d, 0, 0)) - sampleVolume(pos - vec3(d, 0, 0));
            float dy = sampleVolume(pos + vec3(0, d, 0)) - sampleVolume(pos - vec3(0, d, 0));
            float dz = sampleVolume(pos + vec3(0, 0, d)) - sampleVolume(pos - vec3(0, 0, d));
            vec3 grad = vec3(dx, dy, dz);
            float len = length(grad);
            return len > 0.001 ? grad / len : vec3(0.0, 0.0, 1.0);
        }
        
        void main() {

            // Setup ray - map screen UV to ray
            vec2 uv = vUV * 2.0 - 1.0;
            
            // Rotation angles in radians
            float rx = uRotationX * 3.14159265 / 180.0;
            float ry = uRotationY * 3.14159265 / 180.0;
            
            // Camera setup - ray starts from in front of volume, points toward it
            float scale = 1.0 / uZoom;
            vec3 rayOrigin = vec3(uv.x * scale, uv.y * scale, 1.5);
            vec3 rayDir = vec3(0.0, 0.0, -1.0);
            
            // Apply rotation to camera position and direction
            rayOrigin = rotateX(rayOrigin, rx);
            rayOrigin = rotateY(rayOrigin, ry);
            rayDir = rotateX(rayDir, rx);
            rayDir = rotateY(rayDir, ry);
            
            // Normalize ray direction
            rayDir = normalize(rayDir);
            
            // Intersect with volume bounding box
            vec2 tHit = intersectBox(rayOrigin, rayDir);
            
            // Debug: color based on intersection
            if (tHit.x > tHit.y || tHit.y < 0.0) {
                // Ray misses the box
                fragColor = vec4(0.02, 0.02, 0.05, 1.0);
                return;
            }
            
            // Start ray at entry point (not behind camera)
            float tStart = max(tHit.x, 0.0);
            float tEnd = tHit.y;
            
            // Ray marching parameters
            float stepSize = (tEnd - tStart) / 200.0; // Adaptive step size
            stepSize = max(stepSize, 0.002); // Minimum step
            
            vec4 accumulatedColor = vec4(0.0);
            float maxIntensity = 0.0;
            float minIntensity = 1.0;
            bool hitSurface = false;
            
            for (float t = tStart; t < tEnd; t += stepSize) {
                vec3 pos = rayOrigin + rayDir * t;
                float value = sampleVolume(pos);
                
                if (uRenderMode == 0) {
                    // Volume Rendering with transfer function
                    vec4 tfColor = applyTransferFunction(value);
                    
                    // Front-to-back compositing
                    float alpha = tfColor.a * stepSize * 50.0;
                    alpha = clamp(alpha, 0.0, 1.0);
                    
                    accumulatedColor.rgb += (1.0 - accumulatedColor.a) * tfColor.rgb * alpha;
                    accumulatedColor.a += (1.0 - accumulatedColor.a) * alpha;
                    
                    if (accumulatedColor.a > 0.95) break;
                }
                else if (uRenderMode == 1) {
                    // Maximum Intensity Projection
                    maxIntensity = max(maxIntensity, value);
                }
                else if (uRenderMode == 2) {
                    // Minimum Intensity Projection
                    if (value > 0.001) { // Ignore background
                        minIntensity = min(minIntensity, value);
                    }
                }
                else if (uRenderMode == 3) {
                    // Surface Rendering
                    if (value >= uIsoValue) {
                        vec3 normal = computeGradient(pos);
                        vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
                        vec3 viewDir = -rayDir;
                        
                        float diffuse = max(dot(normal, lightDir), 0.0);
                        float specular = pow(max(dot(reflect(-lightDir, normal), viewDir), 0.0), 32.0);
                        
                        vec3 surfaceColor = vec3(0.9, 0.85, 0.8);
                        accumulatedColor.rgb = surfaceColor * (0.2 + 0.6 * diffuse) + vec3(0.3) * specular;
                        accumulatedColor.a = 1.0;
                        hitSurface = true;
                        break;
                    }
                }
            }
            
            // Final color based on render mode
            if (uRenderMode == 1) {
                // MIP result - apply auto-windowing for better contrast
                // Use a simpler approach that scales based on the max value found
                float intensity;
                if (maxIntensity < 0.01) {
                    // Very low values - show red for debugging (ray might not be sampling correctly)
                    fragColor = vec4(maxIntensity * 100.0, 0.0, 0.0, 1.0);
                    return;
                } else if (maxIntensity < 0.25) {
                    // Low HU range (air/lung) - amplify significantly
                    intensity = maxIntensity * 4.0;
                } else {
                    // Normal range - apply bone window
                    intensity = (maxIntensity - 0.15) * 2.0;
                }
                intensity = clamp(intensity, 0.0, 1.0) * uBrightness;
                fragColor = vec4(vec3(intensity), 1.0);
            }
            else if (uRenderMode == 2) {
                // MinIP result
                float intensity = (minIntensity < 1.0 ? minIntensity : 0.0) * uBrightness;
                fragColor = vec4(vec3(intensity), 1.0);
            }
            else {
                // VR or Surface result
                if (accumulatedColor.a < 0.01 && uRenderMode == 3 && !hitSurface) {
                    fragColor = vec4(0.02, 0.02, 0.05, 1.0);
                } else {
                    fragColor = vec4(accumulatedColor.rgb * uBrightness, 1.0);
                }
            }
        }
        `;
    }

    /**
     * Upload volume data as 3D texture
     */
    uploadVolumeTexture(volumeData, dimensions) {
        const gl = this.gl;
        const { width, height, depth } = dimensions;

        console.log(`Uploading 3D texture: ${width}x${height}x${depth}, data length: ${volumeData.length}`);

        // Verify data size matches dimensions
        const expectedSize = width * height * depth;
        if (volumeData.length !== expectedSize) {
            console.error(`Data size mismatch: expected ${expectedSize}, got ${volumeData.length}`);
        }

        // Delete old texture if exists
        if (this.volumeTexture) {
            gl.deleteTexture(this.volumeTexture);
        }

        this.volumeTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.volumeTexture);

        // Set texture parameters
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        // First pass: find actual HU range in the data
        let minVal = Infinity, maxVal = -Infinity;
        for (let i = 0; i < volumeData.length; i++) {
            const hu = volumeData[i];
            if (hu < minVal) minVal = hu;
            if (hu > maxVal) maxVal = hu;
        }
        console.log(`Volume HU range: ${minVal.toFixed(0)} to ${maxVal.toFixed(0)}`);

        // Normalize volume data to 0-1 range
        // Use standard CT display range (-1024 to 3071) for consistent transfer function mapping
        // But clamp actual data values to this range to avoid out-of-range issues
        const huMin = -1024;
        const huMax = 3071;
        const huRange = huMax - huMin;

        // Store the actual data range for reference
        this.actualHURange = { min: minVal, max: maxVal };

        const normalizedData = new Float32Array(volumeData.length);
        let normMin = Infinity, normMax = -Infinity;
        for (let i = 0; i < volumeData.length; i++) {
            // Clamp HU values to the standard CT range before normalizing
            const hu = Math.max(huMin, Math.min(huMax, volumeData[i]));
            normalizedData[i] = (hu - huMin) / huRange;
            if (normalizedData[i] < normMin) normMin = normalizedData[i];
            if (normalizedData[i] > normMax) normMax = normalizedData[i];
        }
        console.log(`Normalized data range: ${normMin.toFixed(4)} to ${normMax.toFixed(4)}`);

        // Check if we need float texture extension
        const floatTexExt = gl.getExtension('EXT_color_buffer_float');
        console.log('Float texture extension:', floatTexExt ? 'supported' : 'not supported');

        try {
            // Try R32F first (best quality)
            gl.texImage3D(
                gl.TEXTURE_3D,
                0,
                gl.R32F,
                width,
                height,
                depth,
                0,
                gl.RED,
                gl.FLOAT,
                normalizedData
            );
            console.log('Uploaded as R32F texture');
        } catch (e) {
            console.warn('R32F failed, trying R16F:', e);
            try {
                // Fallback to R16F
                const halfFloatExt = gl.getExtension('OES_texture_half_float');
                gl.texImage3D(
                    gl.TEXTURE_3D,
                    0,
                    gl.R16F,
                    width,
                    height,
                    depth,
                    0,
                    gl.RED,
                    gl.HALF_FLOAT,
                    normalizedData
                );
                console.log('Uploaded as R16F texture');
            } catch (e2) {
                console.error('Failed to upload 3D texture:', e2);
            }
        }

        // Check for GL errors
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error('GL error after texture upload:', error);
        }

        this.volumeDimensions = dimensions;

        console.log('Volume texture uploaded successfully');
    }

    /**
     * Update transfer function texture
     */
    updateTransferFunctionTexture() {
        const gl = this.gl;
        const size = 256;
        const data = new Float32Array(size * 4); // RGBA

        // Generate transfer function LUT
        for (let i = 0; i < size; i++) {
            const normalizedHU = i / (size - 1); // 0 to 1
            const hu = normalizedHU * (3071 - (-1024)) + (-1024); // Map to HU range

            const color = this.interpolateColor(hu);
            const opacity = this.interpolateOpacity(hu);

            data[i * 4 + 0] = color.r / 255;
            data[i * 4 + 1] = color.g / 255;
            data[i * 4 + 2] = color.b / 255;
            data[i * 4 + 3] = opacity;
        }

        // Create or update texture
        if (!this.transferFunctionTexture) {
            this.transferFunctionTexture = gl.createTexture();
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.transferFunctionTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D(
            gl.TEXTURE_2D,
            0,
            gl.RGBA32F,
            size,
            1,
            0,
            gl.RGBA,
            gl.FLOAT,
            data
        );

        const tfLoc = gl.getUniformLocation(this.program, 'uTransferFunction');
        gl.uniform1i(tfLoc, 1);
    }

    /**
     * Interpolate color from transfer function
     */
    interpolateColor(hu) {
        const points = this.transferFunction.colorPoints;

        if (hu <= points[0].hu) {
            return { r: points[0].r, g: points[0].g, b: points[0].b };
        }
        if (hu >= points[points.length - 1].hu) {
            const last = points[points.length - 1];
            return { r: last.r, g: last.g, b: last.b };
        }

        for (let i = 0; i < points.length - 1; i++) {
            if (hu >= points[i].hu && hu <= points[i + 1].hu) {
                const t = (hu - points[i].hu) / (points[i + 1].hu - points[i].hu);
                return {
                    r: points[i].r + t * (points[i + 1].r - points[i].r),
                    g: points[i].g + t * (points[i + 1].g - points[i].g),
                    b: points[i].b + t * (points[i + 1].b - points[i].b)
                };
            }
        }

        return { r: 0, g: 0, b: 0 };
    }

    /**
     * Interpolate opacity from transfer function
     */
    interpolateOpacity(hu) {
        const points = this.transferFunction.opacityPoints;

        if (hu <= points[0].hu) return points[0].opacity;
        if (hu >= points[points.length - 1].hu) return points[points.length - 1].opacity;

        for (let i = 0; i < points.length - 1; i++) {
            if (hu >= points[i].hu && hu <= points[i + 1].hu) {
                const t = (hu - points[i].hu) / (points[i + 1].hu - points[i].hu);
                return points[i].opacity + t * (points[i + 1].opacity - points[i].opacity);
            }
        }

        return 0;
    }

    /**
     * Set transfer function and update texture
     */
    setTransferFunction(colorPoints, opacityPoints) {
        this.transferFunction.colorPoints = colorPoints;
        this.transferFunction.opacityPoints = opacityPoints;
        this.updateTransferFunctionTexture();
    }

    /**
     * Set render mode
     */
    setRenderMode(mode) {
        this.renderMode = mode;
    }

    /**
     * Set camera rotation
     */
    setRotation(x, y) {
        this.rotation.x = x;
        this.rotation.y = y;
    }

    /**
     * Set camera zoom
     */
    setZoom(zoom) {
        this.zoom = Math.max(0.1, Math.min(10, zoom));
    }

    /**
     * Set ISO value for surface rendering (in HU)
     */
    setIsoValue(hu) {
        this.isoValue = hu;
    }

    /**
     * Render the volume
     */
    render() {
        if (!this.isInitialized || !this.volumeTexture) {
            console.log('Cannot render: initialized=', this.isInitialized, 'volumeTexture=', !!this.volumeTexture);
            return;
        }

        const gl = this.gl;


        // Set viewport
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.05, 0.05, 0.1, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        // Bind textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.volumeTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.transferFunctionTexture);

        // Set texture uniforms
        gl.uniform1i(gl.getUniformLocation(this.program, 'uVolume'), 0);
        gl.uniform1i(gl.getUniformLocation(this.program, 'uTransferFunction'), 1);

        // Set rotation and zoom uniforms
        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uRotationX'),
            this.rotation.x
        );
        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uRotationY'),
            this.rotation.y
        );
        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uZoom'),
            this.zoom
        );

        // Render mode: 0=VR, 1=MIP, 2=MinIP, 3=Surface
        const modeMap = { 'VR': 0, 'MIP': 1, 'MinIP': 2, 'Surface': 3 };
        gl.uniform1i(
            gl.getUniformLocation(this.program, 'uRenderMode'),
            modeMap[this.renderMode] || 0
        );

        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uSampleDistance'),
            this.sampleDistance
        );

        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uBrightness'),
            this.brightness
        );

        // Normalize ISO value to 0-1 range
        const normalizedIso = (this.isoValue - (-1024)) / (3071 - (-1024));
        gl.uniform1f(
            gl.getUniformLocation(this.program, 'uIsoValue'),
            normalizedIso
        );

        gl.uniform3f(
            gl.getUniformLocation(this.program, 'uVolumeDimensions'),
            this.volumeDimensions.width,
            this.volumeDimensions.height,
            this.volumeDimensions.depth
        );

        // Draw fullscreen quad
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        // Check for WebGL errors
        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error('WebGL error after render:', error);
    }

    /**
     * Create model-view matrix with rotation and zoom
     */
    createModelViewMatrix() {
        const m = new Float32Array(16);

        // Start with identity
        m[0] = 1; m[5] = 1; m[10] = 1; m[15] = 1;

        // Apply rotation
        const rx = this.rotation.x * Math.PI / 180;
        const ry = this.rotation.y * Math.PI / 180;

        // Rotation around X
        const cosX = Math.cos(rx);
        const sinX = Math.sin(rx);

        // Rotation around Y
        const cosY = Math.cos(ry);
        const sinY = Math.sin(ry);

        // Combined rotation matrix (Y * X)
        m[0] = cosY;
        m[1] = sinX * sinY;
        m[2] = -cosX * sinY;
        m[4] = 0;
        m[5] = cosX;
        m[6] = sinX;
        m[8] = sinY;
        m[9] = -sinX * cosY;
        m[10] = cosX * cosY;

        // Apply zoom (scale)
        m[0] *= this.zoom;
        m[5] *= this.zoom;
        m[10] *= this.zoom;

        return m;
    }

    /**
     * Create projection matrix
     */
    createProjectionMatrix() {
        const aspect = this.canvas.width / this.canvas.height;
        const fov = 45 * Math.PI / 180;
        const near = 0.1;
        const far = 100;

        const f = 1 / Math.tan(fov / 2);
        const m = new Float32Array(16);

        m[0] = f / aspect;
        m[5] = f;
        m[10] = (far + near) / (near - far);
        m[11] = -1;
        m[14] = (2 * far * near) / (near - far);

        return m;
    }

    /**
     * Resize renderer to match canvas
     */
    resize() {
        let width, height;

        // Try to get dimensions from canvas element style first
        if (this.canvas.clientWidth > 100 && this.canvas.clientHeight > 100) {
            width = this.canvas.clientWidth;
            height = this.canvas.clientHeight;
        } else if (this.canvas.parentElement) {
            // Fall back to parent element dimensions
            const rect = this.canvas.parentElement.getBoundingClientRect();
            width = Math.floor(rect.width);
            height = Math.floor(rect.height);
        } else {
            // Use canvas's own dimensions if already set
            width = this.canvas.width;
            height = this.canvas.height;
        }

        // Ensure minimum size
        width = Math.max(100, width);
        height = Math.max(100, height);

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            console.log(`Canvas resized to ${width}x${height}`);
        }
    }

    /**
     * Dispose of WebGL resources
     */
    dispose() {
        const gl = this.gl;
        if (!gl) return;

        if (this.volumeTexture) gl.deleteTexture(this.volumeTexture);
        if (this.transferFunctionTexture) gl.deleteTexture(this.transferFunctionTexture);
        if (this.program) gl.deleteProgram(this.program);

        this.isInitialized = false;
    }
}

// Export for use in other modules
window.WebGLVolumeRenderer = WebGLVolumeRenderer;

