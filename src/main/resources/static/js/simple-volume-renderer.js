/**
 * Simple Three.js-based Volume Renderer
 * A simpler 3D volume rendering solution using raw WebGL with better error handling.
 * Works as a standalone script without module bundling.
 */

class SimpleVolumeRenderer {
    constructor(container) {
        this.container = container;
        this.canvas = null;
        this.gl = null;
        this.program = null;
        this.volumeTexture = null;
        this.transferTexture = null;
        this.isInitialized = false;
        this.renderMode = 'VR';

        // Volume data
        this.volumeDimensions = { width: 0, height: 0, depth: 0 };
        this.volumeSpacing = { x: 1, y: 1, z: 1 };

        // Camera/view settings
        this.rotation = { x: -20, y: 30 };
        this.zoom = 1.0;

        // Animation
        this.animationId = null;
        this.isAnimating = false;

        // Transfer function (CT Bone default)
        this.transferFunction = this.getDefaultTransferFunction();

        // Mouse interaction
        this.isDragging = false;
        this.lastMouse = { x: 0, y: 0 };
    }

    getDefaultTransferFunction() {
        return {
            colorPoints: [
                { hu: -1024, r: 0, g: 0, b: 0 },
                { hu: -500, r: 0, g: 0, b: 0 },
                { hu: 200, r: 230, g: 210, b: 190 },
                { hu: 500, r: 255, g: 240, b: 220 },
                { hu: 1000, r: 255, g: 255, b: 245 },
                { hu: 3071, r: 255, g: 255, b: 255 }
            ],
            opacityPoints: [
                { hu: -1024, opacity: 0 },
                { hu: 100, opacity: 0 },
                { hu: 200, opacity: 0.15 },
                { hu: 400, opacity: 0.5 },
                { hu: 800, opacity: 0.85 },
                { hu: 3071, opacity: 1.0 }
            ]
        };
    }

    /**
     * Initialize WebGL context and shaders
     */
    async initialize() {
        console.log('Initializing Simple Volume Renderer...');

        try {
            // Create canvas
            this.canvas = document.createElement('canvas');
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            this.container.appendChild(this.canvas);

            // Set canvas size
            this.resizeCanvas();

            // Get WebGL2 context
            this.gl = this.canvas.getContext('webgl2', {
                antialias: true,
                preserveDrawingBuffer: true,
                alpha: false
            });

            if (!this.gl) {
                throw new Error('WebGL2 not supported');
            }

            console.log('WebGL2 context created');
            console.log('Max 3D texture size:', this.gl.getParameter(this.gl.MAX_3D_TEXTURE_SIZE));

            // Create shader program
            this.createShaderProgram();

            // Create geometry (full-screen quad)
            this.createGeometry();

            // Create transfer function texture
            this.updateTransferTexture();

            // Setup mouse/touch interaction
            this.setupInteraction();

            // Handle resize
            window.addEventListener('resize', () => this.resizeCanvas());

            this.isInitialized = true;
            console.log('Simple Volume Renderer initialized successfully');

            return true;
        } catch (error) {
            console.error('Failed to initialize renderer:', error);
            throw error;
        }
    }

    resizeCanvas() {
        if (!this.canvas || !this.container) return;

        const rect = this.container.getBoundingClientRect();
        const width = Math.max(100, Math.floor(rect.width));
        const height = Math.max(100, Math.floor(rect.height));

        if (this.canvas.width !== width || this.canvas.height !== height) {
            this.canvas.width = width;
            this.canvas.height = height;
            console.log(`Canvas resized to ${width}x${height}`);

            if (this.gl) {
                this.gl.viewport(0, 0, width, height);
            }

            this.render();
        }
    }

    setupInteraction() {
        // Mouse down
        this.canvas.addEventListener('mousedown', (e) => {
            this.isDragging = true;
            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.canvas.style.cursor = 'grabbing';
        });

        // Mouse move
        this.canvas.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;

            const dx = e.clientX - this.lastMouse.x;
            const dy = e.clientY - this.lastMouse.y;

            this.rotation.y += dx * 0.5;
            this.rotation.x += dy * 0.5;
            this.rotation.x = Math.max(-89, Math.min(89, this.rotation.x));

            this.lastMouse = { x: e.clientX, y: e.clientY };
            this.render();
        });

        // Mouse up
        document.addEventListener('mouseup', () => {
            this.isDragging = false;
            if (this.canvas) this.canvas.style.cursor = 'grab';
        });

        // Mouse wheel for zoom
        this.canvas.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 0.9 : 1.1;
            this.zoom = Math.max(0.1, Math.min(5, this.zoom * delta));
            this.render();
        });

        // Set initial cursor
        this.canvas.style.cursor = 'grab';
    }

    createShaderProgram() {
        const gl = this.gl;

        const vertexSource = `#version 300 es
            in vec2 aPosition;
            out vec2 vUV;
            void main() {
                vUV = aPosition * 0.5 + 0.5;
                gl_Position = vec4(aPosition, 0.0, 1.0);
            }
        `;

        const fragmentSource = `#version 300 es
            precision highp float;
            precision highp sampler3D;
            
            in vec2 vUV;
            out vec4 fragColor;
            
            uniform sampler3D uVolume;
            uniform sampler2D uTransfer;
            uniform vec3 uDimensions;
            uniform vec3 uSpacing;
            uniform float uRotationX;
            uniform float uRotationY;
            uniform float uZoom;
            uniform int uRenderMode; // 0=VR, 1=MIP, 2=MinIP
            uniform float uAspectRatio;
            
            mat3 rotationMatrix(float rx, float ry) {
                float cx = cos(rx), sx = sin(rx);
                float cy = cos(ry), sy = sin(ry);
                return mat3(
                    cy, 0, sy,
                    sx*sy, cx, -sx*cy,
                    -cx*sy, sx, cx*cy
                );
            }
            
            vec2 intersectBox(vec3 orig, vec3 dir, vec3 boxSize) {
                vec3 boxMin = -boxSize * 0.5;
                vec3 boxMax = boxSize * 0.5;
                vec3 invDir = 1.0 / dir;
                vec3 t0 = (boxMin - orig) * invDir;
                vec3 t1 = (boxMax - orig) * invDir;
                vec3 tmin = min(t0, t1);
                vec3 tmax = max(t0, t1);
                float tNear = max(max(tmin.x, tmin.y), tmin.z);
                float tFar = min(min(tmax.x, tmax.y), tmax.z);
                return vec2(tNear, tFar);
            }
            
            float sampleVolume(vec3 pos, vec3 boxSize) {
                // Convert position in world space to texture coordinates
                vec3 tc = (pos / boxSize) + 0.5;
                if (any(lessThan(tc, vec3(0.0))) || any(greaterThan(tc, vec3(1.0)))) {
                    return 0.0;
                }
                return texture(uVolume, tc).r;
            }
            
            vec4 getTransferColor(float value) {
                return texture(uTransfer, vec2(value, 0.5));
            }
            
            vec3 computeGradient(vec3 pos, float d, vec3 boxSize) {
                vec3 grad = vec3(
                    sampleVolume(pos + vec3(d, 0, 0), boxSize) - sampleVolume(pos - vec3(d, 0, 0), boxSize),
                    sampleVolume(pos + vec3(0, d, 0), boxSize) - sampleVolume(pos - vec3(0, d, 0), boxSize),
                    sampleVolume(pos + vec3(0, 0, d), boxSize) - sampleVolume(pos - vec3(0, 0, d), boxSize)
                );
                float len = length(grad);
                return len > 0.001 ? grad / len : vec3(0.0, 0.0, 1.0);
            }
            
            void main() {
                vec2 uv = vUV * 2.0 - 1.0;
                uv.x *= uAspectRatio;
                
                float rx = radians(uRotationX);
                float ry = radians(uRotationY);
                mat3 rot = rotationMatrix(rx, ry);
                
                // Compute normalized box size based on dimensions and spacing
                vec3 size = uDimensions * uSpacing;
                float maxSize = max(max(size.x, size.y), size.z);
                vec3 boxSize = size / maxSize; // Normalized box size
                
                // Camera setup - orthographic projection
                float scale = 1.2 / uZoom; // Slight zoom out to see full volume
                vec3 rayOrigin = rot * vec3(uv.x * scale, uv.y * scale, 2.0);
                vec3 rayDir = normalize(rot * vec3(0.0, 0.0, -1.0));
                
                vec2 tHit = intersectBox(rayOrigin, rayDir, boxSize);
                
                if (tHit.x > tHit.y || tHit.y < 0.0) {
                    // Outside the box - render dark background
                    fragColor = vec4(0.02, 0.02, 0.04, 1.0);
                    return;
                }
                
                // Debug: show we hit the box with a subtle tint based on entry distance
                // This helps verify ray-box intersection is working
                float debugTint = clamp((tHit.y - tHit.x) * 0.5, 0.0, 0.2);
                
                float tStart = max(tHit.x, 0.0);
                float tEnd = tHit.y;
                float rayLength = tEnd - tStart;
                
                // Adaptive step count based on volume size
                int numSteps = 512;
                float stepSize = rayLength / float(numSteps);
                float gradStep = max(boxSize.x, max(boxSize.y, boxSize.z)) / float(numSteps) * 2.0;
                
                vec4 accum = vec4(0.0);
                float maxIntensity = 0.0;
                float minIntensity = 1.0;
                
                for (int i = 0; i < numSteps; i++) {
                    float t = tStart + (float(i) + 0.5) * stepSize;
                    vec3 pos = rayOrigin + rayDir * t;
                    float value = sampleVolume(pos, boxSize);
                    
                    if (uRenderMode == 0) {
                        // Volume Rendering with enhanced visibility
                        vec4 color = getTransferColor(value);
                        
                        // Boost opacity for better visibility
                        float alpha = color.a * stepSize * 150.0;
                        alpha = clamp(alpha, 0.0, 0.95);
                        
                        // Enhanced shading
                        if (alpha > 0.005) {
                            vec3 normal = computeGradient(pos, gradStep, boxSize);
                            vec3 lightDir = normalize(vec3(0.5, 0.8, 1.0));
                            vec3 viewDir = -rayDir;
                            
                            float diffuse = max(dot(normal, lightDir), 0.0);
                            float ambient = 0.35;
                            
                            // Specular
                            vec3 halfVec = normalize(lightDir + viewDir);
                            float spec = pow(max(dot(normal, halfVec), 0.0), 32.0);
                            
                            color.rgb = color.rgb * (ambient + 0.65 * diffuse) + vec3(0.2) * spec;
                        }
                        
                        // Front-to-back compositing
                        accum.rgb += (1.0 - accum.a) * color.rgb * alpha;
                        accum.a += (1.0 - accum.a) * alpha;
                        
                        if (accum.a > 0.99) break;
                    } else if (uRenderMode == 1) {
                        // MIP - Maximum Intensity Projection
                        maxIntensity = max(maxIntensity, value);
                    } else {
                        // MinIP - Minimum Intensity Projection
                        if (value > 0.02) {
                            minIntensity = min(minIntensity, value);
                        }
                    }
                }
                
                if (uRenderMode == 1) {
                    // MIP with contrast enhancement
                    float v = pow(maxIntensity, 0.7); // Gamma correction for better visibility
                    // Show at least something if maxIntensity is 0
                    if (maxIntensity < 0.001) {
                        fragColor = vec4(debugTint, debugTint * 0.5, debugTint * 0.8, 1.0);
                    } else {
                        fragColor = vec4(vec3(v), 1.0);
                    }
                } else if (uRenderMode == 2) {
                    float val = minIntensity < 1.0 ? minIntensity : 0.0;
                    fragColor = vec4(vec3(val), 1.0);
                } else {
                    // Volume rendering - add slight background if too dark
                    if (accum.a < 0.01) {
                        // Show debug tint if no accumulation
                        fragColor = vec4(debugTint, debugTint * 0.5, debugTint * 0.8, 1.0);
                    } else {
                        fragColor = vec4(accum.rgb, 1.0);
                    }
                }
            }
        `;

        // Compile vertex shader
        const vs = gl.createShader(gl.VERTEX_SHADER);
        gl.shaderSource(vs, vertexSource);
        gl.compileShader(vs);
        if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
            throw new Error('Vertex shader error: ' + gl.getShaderInfoLog(vs));
        }

        // Compile fragment shader
        const fs = gl.createShader(gl.FRAGMENT_SHADER);
        gl.shaderSource(fs, fragmentSource);
        gl.compileShader(fs);
        if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
            throw new Error('Fragment shader error: ' + gl.getShaderInfoLog(fs));
        }

        // Link program
        this.program = gl.createProgram();
        gl.attachShader(this.program, vs);
        gl.attachShader(this.program, fs);
        gl.linkProgram(this.program);

        if (!gl.getProgramParameter(this.program, gl.LINK_STATUS)) {
            throw new Error('Program link error: ' + gl.getProgramInfoLog(this.program));
        }

        gl.useProgram(this.program);
        console.log('Shader program created successfully');
    }

    createGeometry() {
        const gl = this.gl;

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
     * Load volume data
     */
    async loadVolume(huData, dimensions, spacing = { x: 1, y: 1, z: 1 }) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        const gl = this.gl;
        const { width, height, depth } = dimensions;

        console.log(`[SimpleVolumeRenderer] Loading volume: ${width}x${height}x${depth}`);
        console.log(`[SimpleVolumeRenderer] Spacing: ${spacing.x}x${spacing.y}x${spacing.z}`);
        console.log(`[SimpleVolumeRenderer] Data type: ${huData?.constructor?.name}, length: ${huData?.length}, expected: ${width * height * depth}`);

        // Validate data
        if (!huData || huData.length === 0) {
            console.error('[SimpleVolumeRenderer] ERROR: huData is empty or null!');
            throw new Error('Volume data is empty');
        }

        if (huData.length !== width * height * depth) {
            console.warn(`[SimpleVolumeRenderer] WARNING: Data length mismatch! Got ${huData.length}, expected ${width * height * depth}`);
        }

        // Sample some values for debugging
        const sampleIndices = [0, 100, 1000, Math.floor(huData.length / 2), huData.length - 1];
        console.log('[SimpleVolumeRenderer] Sample HU values at indices:', sampleIndices.map(i => `[${i}]=${huData[i]}`).join(', '));

        // Normalize HU data to 0-1
        const huMin = -1024;
        const huMax = 3071;
        const huRange = huMax - huMin;

        const normalizedData = new Float32Array(huData.length);
        let minVal = Infinity, maxVal = -Infinity;
        let zeroCount = 0;
        let validCount = 0;

        for (let i = 0; i < huData.length; i++) {
            const hu = huData[i];
            if (hu === 0) zeroCount++;
            if (isFinite(hu)) validCount++;
            minVal = Math.min(minVal, hu);
            maxVal = Math.max(maxVal, hu);
            normalizedData[i] = Math.max(0, Math.min(1, (hu - huMin) / huRange));
        }

        console.log(`[SimpleVolumeRenderer] HU range in data: ${minVal.toFixed(0)} to ${maxVal.toFixed(0)}`);
        console.log(`[SimpleVolumeRenderer] Zero values: ${zeroCount}/${huData.length} (${(100*zeroCount/huData.length).toFixed(1)}%)`);
        console.log(`[SimpleVolumeRenderer] Valid (finite) values: ${validCount}/${huData.length}`);

        // Check for all-zero or all-same data
        if (minVal === maxVal) {
            console.error(`[SimpleVolumeRenderer] ERROR: All values are the same (${minVal})! This will render as a solid block.`);
        }

        // Sample normalized values
        console.log('[SimpleVolumeRenderer] Sample normalized values:', sampleIndices.map(i => `[${i}]=${normalizedData[i].toFixed(4)}`).join(', '));

        // Analyze normalized data distribution
        let normZeroCount = 0;
        let normNonZeroCount = 0;
        for (let i = 0; i < normalizedData.length; i++) {
            if (normalizedData[i] < 0.001) normZeroCount++;
            else normNonZeroCount++;
        }
        console.log(`[SimpleVolumeRenderer] Normalized data: ${normNonZeroCount} non-zero values, ${normZeroCount} near-zero values`);

        // Delete old texture
        if (this.volumeTexture) {
            gl.deleteTexture(this.volumeTexture);
        }

        // Check for OES_texture_float_linear extension (needed for LINEAR filtering on float textures)
        const floatLinearExt = gl.getExtension('OES_texture_float_linear');
        console.log('[SimpleVolumeRenderer] OES_texture_float_linear extension:', floatLinearExt ? 'available' : 'NOT available');

        const useLinearFilter = floatLinearExt !== null;

        // Create 3D texture
        this.volumeTexture = gl.createTexture();
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.volumeTexture);

        // Use NEAREST if LINEAR filtering is not supported for floats
        const filterType = useLinearFilter ? gl.LINEAR : gl.NEAREST;
        console.log('[SimpleVolumeRenderer] Using texture filter:', useLinearFilter ? 'LINEAR' : 'NEAREST');

        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, filterType);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, filterType);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);

        console.log(`[SimpleVolumeRenderer] Uploading 3D texture: ${width}x${height}x${depth} = ${normalizedData.length} floats`);

        // Clear any previous errors
        while (gl.getError() !== gl.NO_ERROR) {}

        // Upload texture data
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

        const error = gl.getError();
        if (error !== gl.NO_ERROR) {
            console.error('[SimpleVolumeRenderer] GL error after texture upload:', error);
            console.error('[SimpleVolumeRenderer] GL error codes: INVALID_ENUM=1280, INVALID_VALUE=1281, INVALID_OPERATION=1282, OUT_OF_MEMORY=1285');
        } else {
            console.log('[SimpleVolumeRenderer] 3D texture uploaded successfully');
        }

        // Verify texture is valid
        console.log('[SimpleVolumeRenderer] Volume texture object:', this.volumeTexture);
        console.log('[SimpleVolumeRenderer] Is texture:', gl.isTexture(this.volumeTexture));

        this.volumeDimensions = dimensions;
        this.volumeSpacing = spacing;

        console.log('[SimpleVolumeRenderer] Volume dimensions set:', this.volumeDimensions);

        // Always start with MIP mode to verify data is loaded correctly
        // MIP is simpler and more likely to show the volume data
        console.log('[SimpleVolumeRenderer] Setting initial render mode to MIP for debugging');
        this.renderMode = 'MIP';

        // Initial render
        console.log('[SimpleVolumeRenderer] Calling initial render...');
        this.render();

        return true;
    }

    /**
     * Load synthetic test volume to verify renderer is working
     */
    loadTestVolume() {
        console.log('[SimpleVolumeRenderer] Loading synthetic test volume...');

        const size = 64;
        const testData = new Float32Array(size * size * size);

        // Create a 3D sphere pattern
        const center = size / 2;
        const radius = size / 3;

        for (let z = 0; z < size; z++) {
            for (let y = 0; y < size; y++) {
                for (let x = 0; x < size; x++) {
                    const dx = x - center;
                    const dy = y - center;
                    const dz = z - center;
                    const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);

                    // HU value: air outside sphere, bone inside
                    const hu = dist < radius ? 500 + (radius - dist) * 50 : -1000;
                    testData[z * size * size + y * size + x] = hu;
                }
            }
        }

        console.log('[SimpleVolumeRenderer] Created synthetic sphere with HU range -1000 to ~1500');

        return this.loadVolume(testData, { width: size, height: size, depth: size }, { x: 1, y: 1, z: 1 });
    }

    updateTransferTexture() {
        const gl = this.gl;
        const size = 256;
        const data = new Float32Array(size * 4);

        const huMin = -1024;
        const huMax = 3071;
        const huRange = huMax - huMin;

        for (let i = 0; i < size; i++) {
            const normalizedHU = i / (size - 1);
            const hu = normalizedHU * huRange + huMin;

            const color = this.interpolateColor(hu);
            const opacity = this.interpolateOpacity(hu);

            data[i * 4 + 0] = color.r / 255;
            data[i * 4 + 1] = color.g / 255;
            data[i * 4 + 2] = color.b / 255;
            data[i * 4 + 3] = opacity;
        }

        if (!this.transferTexture) {
            this.transferTexture = gl.createTexture();
        }

        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.transferTexture);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA32F, size, 1, 0, gl.RGBA, gl.FLOAT, data);
    }

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
     * Apply a preset transfer function
     */
    applyPreset(presetName) {
        const presets = {
            'ct-bone': {
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -500, r: 0, g: 0, b: 0 },
                    { hu: 200, r: 230, g: 210, b: 190 },
                    { hu: 500, r: 255, g: 240, b: 220 },
                    { hu: 1000, r: 255, g: 255, b: 245 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: 100, opacity: 0 },
                    { hu: 200, opacity: 0.15 },
                    { hu: 400, opacity: 0.5 },
                    { hu: 800, opacity: 0.85 },
                    { hu: 3071, opacity: 1.0 }
                ]
            },
            'ct-soft-tissue': {
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -100, r: 0, g: 0, b: 0 },
                    { hu: 0, r: 140, g: 65, b: 40 },
                    { hu: 100, r: 225, g: 155, b: 130 },
                    { hu: 200, r: 255, g: 205, b: 180 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -100, opacity: 0 },
                    { hu: 0, opacity: 0.1 },
                    { hu: 100, opacity: 0.3 },
                    { hu: 200, opacity: 0.1 },
                    { hu: 3071, opacity: 0 }
                ]
            },
            'ct-lung': {
                colorPoints: [
                    { hu: -1024, r: 0, g: 50, b: 100 },
                    { hu: -900, r: 50, g: 100, b: 150 },
                    { hu: -700, r: 100, g: 150, b: 200 },
                    { hu: -500, r: 150, g: 200, b: 255 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -900, opacity: 0.2 },
                    { hu: -800, opacity: 0.4 },
                    { hu: -600, opacity: 0.3 },
                    { hu: -400, opacity: 0 },
                    { hu: 3071, opacity: 0 }
                ]
            },
            'mip': {
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: 0, r: 80, g: 80, b: 80 },
                    { hu: 500, r: 180, g: 180, b: 180 },
                    { hu: 1000, r: 255, g: 255, b: 255 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: 0, opacity: 0.1 },
                    { hu: 500, opacity: 0.5 },
                    { hu: 1000, opacity: 0.9 },
                    { hu: 3071, opacity: 1.0 }
                ]
            }
        };

        const preset = presets[presetName] || presets['ct-bone'];
        this.transferFunction = preset;
        this.updateTransferTexture();
        this.render();
    }

    /**
     * Set render mode
     */
    setRenderMode(mode) {
        console.log('Setting render mode:', mode);
        this.renderMode = mode;
        this.render();
    }

    /**
     * Render the scene
     */
    render() {
        if (!this.isInitialized) {
            console.warn('[SimpleVolumeRenderer] render() called but not initialized');
            return;
        }

        if (!this.volumeTexture) {
            console.warn('[SimpleVolumeRenderer] render() called but no volumeTexture');
            // Render a test pattern to prove WebGL is working
            this.renderTestPattern();
            return;
        }

        const gl = this.gl;

        // Log render state for debugging
        console.log('[SimpleVolumeRenderer] Rendering with:', {
            dimensions: this.volumeDimensions,
            spacing: this.volumeSpacing,
            rotation: this.rotation,
            zoom: this.zoom,
            mode: this.renderMode,
            canvasSize: { w: this.canvas.width, h: this.canvas.height }
        });

        // Check for any previous GL errors
        let err = gl.getError();
        if (err !== gl.NO_ERROR) {
            console.warn('[SimpleVolumeRenderer] Pre-render GL error:', err);
        }

        gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        gl.clearColor(0.03, 0.03, 0.06, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        gl.useProgram(this.program);

        // Bind textures
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_3D, this.volumeTexture);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, this.transferTexture);

        // Set uniforms
        const volumeLoc = gl.getUniformLocation(this.program, 'uVolume');
        const transferLoc = gl.getUniformLocation(this.program, 'uTransfer');
        const dimensionsLoc = gl.getUniformLocation(this.program, 'uDimensions');
        const spacingLoc = gl.getUniformLocation(this.program, 'uSpacing');
        const rotXLoc = gl.getUniformLocation(this.program, 'uRotationX');
        const rotYLoc = gl.getUniformLocation(this.program, 'uRotationY');
        const zoomLoc = gl.getUniformLocation(this.program, 'uZoom');
        const aspectLoc = gl.getUniformLocation(this.program, 'uAspectRatio');
        const modeLoc = gl.getUniformLocation(this.program, 'uRenderMode');

        // Log which uniforms were found (only log once when renderCount is 1)
        if (!this._renderCount) this._renderCount = 0;
        this._renderCount++;
        if (this._renderCount === 1) {
            console.log('[SimpleVolumeRenderer] Uniform locations:', {
                uVolume: volumeLoc !== null,
                uTransfer: transferLoc !== null,
                uDimensions: dimensionsLoc !== null,
                uSpacing: spacingLoc !== null,
                uRotationX: rotXLoc !== null,
                uRotationY: rotYLoc !== null,
                uZoom: zoomLoc !== null,
                uAspectRatio: aspectLoc !== null,
                uRenderMode: modeLoc !== null
            });
        }

        gl.uniform1i(volumeLoc, 0);
        gl.uniform1i(transferLoc, 1);

        gl.uniform3f(dimensionsLoc,
            this.volumeDimensions.width,
            this.volumeDimensions.height,
            this.volumeDimensions.depth
        );

        gl.uniform3f(spacingLoc,
            this.volumeSpacing.x || 1,
            this.volumeSpacing.y || 1,
            this.volumeSpacing.z || 1
        );

        gl.uniform1f(rotXLoc, this.rotation.x);
        gl.uniform1f(rotYLoc, this.rotation.y);
        gl.uniform1f(zoomLoc, this.zoom);
        gl.uniform1f(aspectLoc, this.canvas.width / this.canvas.height);

        // Render mode: 0=VR, 1=MIP, 2=MinIP
        const modeMap = { 'VR': 0, 'MIP': 1, 'MinIP': 2, 'AIP': 0, 'Surface': 0 };
        gl.uniform1i(modeLoc, modeMap[this.renderMode] || 0);

        // Draw
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

        err = gl.getError();
        if (err !== gl.NO_ERROR) {
            console.error('[SimpleVolumeRenderer] Post-render GL error:', err);
        }
    }

    /**
     * Render a simple test pattern to verify WebGL is working
     */
    renderTestPattern() {
        if (!this.gl || !this.canvas) return;

        const gl = this.gl;
        gl.viewport(0, 0, this.canvas.width, this.canvas.height);

        // Render with a gradient to show WebGL is working
        gl.clearColor(0.2, 0.1, 0.3, 1);
        gl.clear(gl.COLOR_BUFFER_BIT);

        console.log('[SimpleVolumeRenderer] Rendered test pattern (purple) - waiting for volume data');
    }

    /**
     * Reset camera
     */
    resetCamera() {
        this.rotation = { x: -20, y: 30 };
        this.zoom = 1.0;
        this.render();
    }

    /**
     * Set standard view
     */
    setStandardView(view) {
        const views = {
            'anterior': { x: 0, y: 0 },
            'posterior': { x: 0, y: 180 },
            'left': { x: 0, y: -90 },
            'right': { x: 0, y: 90 },
            'superior': { x: -90, y: 0 },
            'inferior': { x: 90, y: 0 }
        };

        const v = views[view] || views['anterior'];
        this.rotation = { ...v };
        this.render();
    }

    /**
     * Toggle animation
     */
    toggleAnimation() {
        if (this.isAnimating) {
            this.stopAnimation();
            return false;
        } else {
            this.startAnimation();
            return true;
        }
    }

    startAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const animate = () => {
            if (!this.isAnimating) return;
            this.rotation.y += 1;
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    stopAnimation() {
        this.isAnimating = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Set sample distance (quality)
     */
    setSampleDistance(distance) {
        // This would require recompiling shader, so just re-render
        this.render();
    }

    /**
     * Toggle shading
     */
    setShading(enabled) {
        // Shading is always on in this implementation
        this.render();
    }

    /**
     * Set shading parameters
     */
    setShadingParams(ambient, diffuse, specular) {
        // Would require shader modification
        this.render();
    }

    /**
     * Capture screenshot
     */
    captureScreenshot() {
        if (!this.canvas) return null;
        this.render(); // Ensure latest frame
        return this.canvas.toDataURL('image/png');
    }

    /**
     * Resize handler
     */
    resize() {
        this.resizeCanvas();
    }

    /**
     * Dispose
     */
    dispose() {
        this.stopAnimation();

        if (this.volumeTexture && this.gl) {
            this.gl.deleteTexture(this.volumeTexture);
        }
        if (this.transferTexture && this.gl) {
            this.gl.deleteTexture(this.transferTexture);
        }
        if (this.program && this.gl) {
            this.gl.deleteProgram(this.program);
        }

        if (this.canvas && this.canvas.parentElement) {
            this.canvas.parentElement.removeChild(this.canvas);
        }

        this.isInitialized = false;
    }
}

// Export globally
window.SimpleVolumeRenderer = SimpleVolumeRenderer;

