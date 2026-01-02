/**
 * Advanced 3D Reconstruction Module
 * Provides comprehensive 3D visualization capabilities:
 * - Volume Rendering (VR)
 * - Maximum Intensity Projection (MIP)
 * - Minimum Intensity Projection (MinIP)
 * - Average Intensity Projection (AIP)
 * - Surface Rendering (Isosurface)
 * - Curved Planar Reformation (CPR)
 * - Transfer Function Editor
 * - 3D Clipping Planes
 * - Advanced Presets Management
 */

class Reconstruction3D {
    constructor() {
        this.volumeId = null;
        this.viewport = null;
        this.viewportElement = null;
        this.isInitialized = false;

        // Current rendering mode
        this.renderMode = 'VR'; // VR, MIP, MinIP, AIP, Surface

        // Transfer function state
        this.transferFunction = {
            colorMap: 'grayscale',
            opacityPoints: [
                { value: 0, opacity: 0 },
                { value: 500, opacity: 0.1 },
                { value: 1000, opacity: 0.5 },
                { value: 2000, opacity: 1.0 }
            ],
            colorPoints: [
                { value: 0, color: [0, 0, 0] },
                { value: 500, color: [255, 128, 64] },
                { value: 1000, color: [255, 255, 200] },
                { value: 2000, color: [255, 255, 255] }
            ]
        };

        // Clipping planes
        this.clippingPlanes = {
            enabled: false,
            axial: { position: 0.5, enabled: false, inverted: false },
            sagittal: { position: 0.5, enabled: false, inverted: false },
            coronal: { position: 0.5, enabled: false, inverted: false }
        };

        // Camera state
        this.camera = {
            position: [0, 0, 500],
            focalPoint: [0, 0, 0],
            viewUp: [0, 1, 0],
            zoom: 1.0
        };

        // Quality settings
        this.quality = {
            sampleDistance: 1.0,
            interactiveQuality: 0.5,
            finalQuality: 1.0,
            shadingEnabled: true,
            ambient: 0.2,
            diffuse: 0.7,
            specular: 0.3,
            specularPower: 10
        };

        // Rendering presets
        this.presets = {
            'ct-bone': {
                name: 'CT Bone',
                description: 'Bone visualization with high density threshold',
                renderMode: 'VR',
                colorMap: 'bone',
                transferFunction: {
                    opacityPoints: [
                        { value: -1000, opacity: 0 },
                        { value: 150, opacity: 0 },
                        { value: 300, opacity: 0.3 },
                        { value: 500, opacity: 0.7 },
                        { value: 2000, opacity: 1.0 }
                    ],
                    colorPoints: [
                        { value: 150, color: [255, 230, 200] },
                        { value: 500, color: [255, 255, 220] },
                        { value: 2000, color: [255, 255, 255] }
                    ]
                },
                shadingEnabled: true
            },
            'ct-soft-tissue': {
                name: 'CT Soft Tissue',
                description: 'Soft tissue and muscle visualization',
                renderMode: 'VR',
                colorMap: 'soft-tissue',
                transferFunction: {
                    opacityPoints: [
                        { value: -1000, opacity: 0 },
                        { value: -200, opacity: 0 },
                        { value: 0, opacity: 0.1 },
                        { value: 100, opacity: 0.4 },
                        { value: 300, opacity: 0.2 }
                    ],
                    colorPoints: [
                        { value: -200, color: [0, 0, 0] },
                        { value: 0, color: [200, 100, 100] },
                        { value: 100, color: [255, 200, 180] },
                        { value: 300, color: [255, 230, 200] }
                    ]
                },
                shadingEnabled: true
            },
            'ct-skin': {
                name: 'CT Skin',
                description: 'Skin surface rendering',
                renderMode: 'Surface',
                isoValue: -200,
                colorMap: 'skin',
                color: [255, 220, 185],
                shadingEnabled: true
            },
            'ct-lung': {
                name: 'CT Lung',
                description: 'Lung parenchyma visualization',
                renderMode: 'VR',
                colorMap: 'lung',
                transferFunction: {
                    opacityPoints: [
                        { value: -1000, opacity: 0.1 },
                        { value: -800, opacity: 0.3 },
                        { value: -600, opacity: 0.4 },
                        { value: -400, opacity: 0.1 },
                        { value: 0, opacity: 0 }
                    ],
                    colorPoints: [
                        { value: -1000, color: [0, 50, 100] },
                        { value: -800, color: [100, 150, 200] },
                        { value: -600, color: [150, 200, 255] },
                        { value: -400, color: [200, 220, 255] }
                    ]
                },
                shadingEnabled: false
            },
            'ct-vascular': {
                name: 'CT Vascular (CTA)',
                description: 'Blood vessel visualization with contrast',
                renderMode: 'MIP',
                windowCenter: 200,
                windowWidth: 400,
                colorMap: 'vascular',
                transferFunction: {
                    opacityPoints: [
                        { value: 0, opacity: 0 },
                        { value: 100, opacity: 0 },
                        { value: 200, opacity: 0.5 },
                        { value: 400, opacity: 1.0 }
                    ],
                    colorPoints: [
                        { value: 100, color: [0, 0, 0] },
                        { value: 200, color: [255, 100, 100] },
                        { value: 400, color: [255, 255, 255] }
                    ]
                }
            },
            'ct-cardiac': {
                name: 'CT Cardiac',
                description: 'Heart and great vessels',
                renderMode: 'VR',
                colorMap: 'cardiac',
                transferFunction: {
                    opacityPoints: [
                        { value: -100, opacity: 0 },
                        { value: 50, opacity: 0.2 },
                        { value: 200, opacity: 0.5 },
                        { value: 400, opacity: 0.3 }
                    ],
                    colorPoints: [
                        { value: -100, color: [0, 0, 0] },
                        { value: 50, color: [200, 50, 50] },
                        { value: 200, color: [255, 100, 100] },
                        { value: 400, color: [255, 200, 150] }
                    ]
                },
                shadingEnabled: true
            },
            'mip': {
                name: 'Maximum Intensity Projection',
                description: 'Shows brightest voxels along ray',
                renderMode: 'MIP',
                colorMap: 'grayscale',
                windowCenter: 400,
                windowWidth: 1500
            },
            'minip': {
                name: 'Minimum Intensity Projection',
                description: 'Shows darkest voxels along ray (airways)',
                renderMode: 'MinIP',
                colorMap: 'grayscale',
                windowCenter: -600,
                windowWidth: 1200
            },
            'aip': {
                name: 'Average Intensity Projection',
                description: 'Average of voxels along ray (thick slab)',
                renderMode: 'AIP',
                colorMap: 'grayscale',
                slabThickness: 10
            },
            'mr-brain': {
                name: 'MR Brain',
                description: 'Brain tissue visualization',
                renderMode: 'VR',
                colorMap: 'brain',
                transferFunction: {
                    opacityPoints: [
                        { value: 0, opacity: 0 },
                        { value: 100, opacity: 0.1 },
                        { value: 300, opacity: 0.4 },
                        { value: 600, opacity: 0.8 }
                    ],
                    colorPoints: [
                        { value: 0, color: [0, 0, 0] },
                        { value: 100, color: [100, 100, 120] },
                        { value: 300, color: [200, 200, 220] },
                        { value: 600, color: [255, 255, 255] }
                    ]
                },
                shadingEnabled: true
            },
            'mr-mra': {
                name: 'MR Angiography',
                description: 'MRA vessel visualization',
                renderMode: 'MIP',
                colorMap: 'grayscale',
                windowCenter: 500,
                windowWidth: 1000
            }
        };

        // CPR (Curved Planar Reformation) state
        this.cpr = {
            enabled: false,
            centerline: [],
            width: 50,
            thickness: 1
        };

        // Animation state
        this.animation = {
            isPlaying: false,
            rotationSpeed: 1,
            rotationAxis: 'Y',
            animationId: null
        };
    }

    /**
     * Initialize the 3D reconstruction module
     */
    async initialize(viewportId = 'viewport-3d') {
        console.log('Initializing Advanced 3D Reconstruction Module...');

        try {
            // Check for WebGL support
            if (!this.checkWebGLSupport()) {
                showToast('WebGL not supported', 'error');
                return false;
            }

            // Store viewport reference
            this.viewportId = viewportId;

            this.isInitialized = true;
            console.log('3D Reconstruction module initialized');
            return true;
        } catch (error) {
            console.error('Failed to initialize 3D Reconstruction:', error);
            return false;
        }
    }

    /**
     * Check WebGL support
     */
    checkWebGLSupport() {
        try {
            const canvas = document.createElement('canvas');
            const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
            return !!gl;
        } catch (e) {
            return false;
        }
    }

    /**
     * Setup 3D viewport layout
     */
    async setup3DLayout() {
        const grid = document.getElementById('viewportGrid');
        if (!grid) return;

        grid.className = 'viewport-grid layout-3d';
        grid.innerHTML = '';

        // Create main 3D viewport
        const viewport3D = this.create3DViewportElement(0);
        grid.appendChild(viewport3D);

        // Create side panel with thumbnails/controls
        const controlPanel = this.create3DControlPanel();
        grid.appendChild(controlPanel);

        // Initialize viewport
        this.viewportElement = document.getElementById('viewport-element-3d-0');

        // Show 3D controls
        const renderingControls = document.getElementById('renderingControls');
        if (renderingControls) renderingControls.style.display = 'flex';

        const mprControls = document.getElementById('mprControls');
        if (mprControls) mprControls.style.display = 'none';

        showToast('3D Reconstruction', '3D layout ready - Load a CT/MR series', 'info');
    }

    /**
     * Create 3D viewport element
     */
    create3DViewportElement(index) {
        const viewportDiv = document.createElement('div');
        viewportDiv.className = 'viewport viewport-3d';
        viewportDiv.id = `viewport-3d-${index}`;

        viewportDiv.innerHTML = `
            <div class="viewport-header-3d">
                <span class="view-label">3D Volume Rendering</span>
                <div class="viewport-actions-3d">
                    <button class="vp-btn-3d" onclick="reconstruction3D.toggleFullscreen()" title="Fullscreen">⛶</button>
                    <button class="vp-btn-3d" onclick="reconstruction3D.resetCamera()" title="Reset View">↺</button>
                    <button class="vp-btn-3d" onclick="reconstruction3D.captureScreenshot()" title="Screenshot">📷</button>
                </div>
            </div>
            <div class="viewport-overlay top-left">
                <span id="overlay-3d-patient"></span>
                <span id="overlay-3d-study"></span>
            </div>
            <div class="viewport-overlay top-right">
                <span id="overlay-3d-mode">${this.renderMode}</span>
                <span id="overlay-3d-preset"></span>
            </div>
            <div class="viewport-overlay bottom-left">
                <span id="overlay-3d-quality">Quality: ${this.quality.finalQuality * 100}%</span>
            </div>
            <div class="viewport-overlay bottom-right">
                <span id="overlay-3d-zoom">Zoom: ${(this.camera.zoom * 100).toFixed(0)}%</span>
            </div>
            <div class="viewport-element" id="viewport-element-3d-${index}"></div>
            <div class="viewport-empty" id="viewport-empty-3d-${index}">
                <div class="empty-content">
                    <div class="empty-icon">🧊</div>
                    <h4>3D Volume Rendering</h4>
                    <p>Load a CT/MR series to enable 3D visualization</p>
                </div>
            </div>
            <!-- 3D Navigation Controls -->
            <div class="navigation-cube" id="nav-cube-${index}">
                <div class="cube-face front" onclick="reconstruction3D.setStandardView('anterior')">A</div>
                <div class="cube-face back" onclick="reconstruction3D.setStandardView('posterior')">P</div>
                <div class="cube-face right" onclick="reconstruction3D.setStandardView('right')">R</div>
                <div class="cube-face left" onclick="reconstruction3D.setStandardView('left')">L</div>
                <div class="cube-face top" onclick="reconstruction3D.setStandardView('superior')">S</div>
                <div class="cube-face bottom" onclick="reconstruction3D.setStandardView('inferior')">I</div>
            </div>
            <!-- Animation Controls -->
            <div class="animation-controls" id="anim-controls-${index}">
                <button class="anim-btn" onclick="reconstruction3D.toggleAnimation()" id="anim-play-btn" title="Play/Pause Animation">
                    ▶️
                </button>
                <input type="range" class="anim-speed" id="anim-speed" min="0.1" max="5" step="0.1" value="1" 
                       onchange="reconstruction3D.setAnimationSpeed(this.value)" title="Rotation Speed">
                <select class="anim-axis" id="anim-axis" onchange="reconstruction3D.setRotationAxis(this.value)" title="Rotation Axis">
                    <option value="Y">Y Axis</option>
                    <option value="X">X Axis</option>
                    <option value="Z">Z Axis</option>
                </select>
            </div>
        `;

        // Setup event handlers
        this.setup3DViewportEvents(viewportDiv, index);

        return viewportDiv;
    }

    /**
     * Create 3D control panel
     */
    create3DControlPanel() {
        const panel = document.createElement('div');
        panel.className = 'control-panel-3d';
        panel.id = 'control-panel-3d';

        panel.innerHTML = `
            <div class="panel-section">
                <h4>🎨 Rendering Mode</h4>
                <div class="render-mode-grid">
                    <button class="mode-btn active" data-mode="VR" onclick="reconstruction3D.setRenderMode('VR')" title="Volume Rendering">
                        <span class="mode-icon">🧊</span>
                        <span>VR</span>
                    </button>
                    <button class="mode-btn" data-mode="MIP" onclick="reconstruction3D.setRenderMode('MIP')" title="Maximum Intensity Projection">
                        <span class="mode-icon">📊</span>
                        <span>MIP</span>
                    </button>
                    <button class="mode-btn" data-mode="MinIP" onclick="reconstruction3D.setRenderMode('MinIP')" title="Minimum Intensity Projection">
                        <span class="mode-icon">📉</span>
                        <span>MinIP</span>
                    </button>
                    <button class="mode-btn" data-mode="AIP" onclick="reconstruction3D.setRenderMode('AIP')" title="Average Intensity Projection">
                        <span class="mode-icon">📈</span>
                        <span>AIP</span>
                    </button>
                    <button class="mode-btn" data-mode="Surface" onclick="reconstruction3D.setRenderMode('Surface')" title="Surface Rendering">
                        <span class="mode-icon">🔷</span>
                        <span>Surface</span>
                    </button>
                </div>
            </div>

            <div class="panel-section">
                <h4>🎯 Presets</h4>
                <select id="preset-select-3d" class="form-input" onchange="reconstruction3D.applyPreset(this.value)">
                    <option value="">Select Preset...</option>
                    <optgroup label="CT Presets">
                        <option value="ct-bone">🦴 Bone</option>
                        <option value="ct-soft-tissue">🫀 Soft Tissue</option>
                        <option value="ct-skin">👤 Skin</option>
                        <option value="ct-lung">🫁 Lung</option>
                        <option value="ct-vascular">🩸 Vascular (CTA)</option>
                        <option value="ct-cardiac">❤️ Cardiac</option>
                    </optgroup>
                    <optgroup label="MR Presets">
                        <option value="mr-brain">🧠 Brain</option>
                        <option value="mr-mra">🩸 MRA</option>
                    </optgroup>
                    <optgroup label="Projections">
                        <option value="mip">📊 MIP</option>
                        <option value="minip">📉 MinIP</option>
                        <option value="aip">📈 AIP</option>
                    </optgroup>
                </select>
            </div>

            <div class="panel-section">
                <h4>⚙️ Quality</h4>
                <div class="quality-controls">
                    <label>Sample Distance</label>
                    <input type="range" id="sample-distance" min="0.25" max="4" step="0.25" value="1" 
                           oninput="reconstruction3D.setSampleDistance(this.value)">
                    <span id="sample-distance-label">1.0x</span>
                </div>
                <div class="quality-controls">
                    <label>Interactive Quality</label>
                    <input type="range" id="interactive-quality" min="0.1" max="1" step="0.1" value="0.5" 
                           oninput="reconstruction3D.setInteractiveQuality(this.value)">
                    <span id="interactive-quality-label">50%</span>
                </div>
            </div>

            <div class="panel-section">
                <h4>💡 Shading</h4>
                <div class="shading-controls">
                    <label class="toggle-label">
                        <input type="checkbox" id="shading-enabled" checked 
                               onchange="reconstruction3D.toggleShading(this.checked)">
                        <span>Enable Shading</span>
                    </label>
                    <div class="shading-sliders" id="shading-sliders">
                        <div class="slider-row">
                            <label>Ambient</label>
                            <input type="range" id="ambient" min="0" max="1" step="0.05" value="0.2" 
                                   oninput="reconstruction3D.setShading('ambient', this.value)">
                            <span id="ambient-label">0.2</span>
                        </div>
                        <div class="slider-row">
                            <label>Diffuse</label>
                            <input type="range" id="diffuse" min="0" max="1" step="0.05" value="0.7" 
                                   oninput="reconstruction3D.setShading('diffuse', this.value)">
                            <span id="diffuse-label">0.7</span>
                        </div>
                        <div class="slider-row">
                            <label>Specular</label>
                            <input type="range" id="specular" min="0" max="1" step="0.05" value="0.3" 
                                   oninput="reconstruction3D.setShading('specular', this.value)">
                            <span id="specular-label">0.3</span>
                        </div>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4>✂️ Clipping Planes</h4>
                <div class="clipping-controls">
                    <label class="toggle-label">
                        <input type="checkbox" id="clipping-enabled" 
                               onchange="reconstruction3D.toggleClipping(this.checked)">
                        <span>Enable Clipping</span>
                    </label>
                    <div class="clipping-sliders" id="clipping-sliders" style="display: none;">
                        <div class="clip-row">
                            <label>
                                <input type="checkbox" id="clip-axial" 
                                       onchange="reconstruction3D.toggleClipPlane('axial', this.checked)">
                                Axial
                            </label>
                            <input type="range" id="clip-axial-pos" min="0" max="1" step="0.01" value="0.5" 
                                   oninput="reconstruction3D.setClipPosition('axial', this.value)">
                            <button class="invert-btn" onclick="reconstruction3D.invertClipPlane('axial')" title="Invert">⇅</button>
                        </div>
                        <div class="clip-row">
                            <label>
                                <input type="checkbox" id="clip-sagittal" 
                                       onchange="reconstruction3D.toggleClipPlane('sagittal', this.checked)">
                                Sagittal
                            </label>
                            <input type="range" id="clip-sagittal-pos" min="0" max="1" step="0.01" value="0.5" 
                                   oninput="reconstruction3D.setClipPosition('sagittal', this.value)">
                            <button class="invert-btn" onclick="reconstruction3D.invertClipPlane('sagittal')" title="Invert">⇅</button>
                        </div>
                        <div class="clip-row">
                            <label>
                                <input type="checkbox" id="clip-coronal" 
                                       onchange="reconstruction3D.toggleClipPlane('coronal', this.checked)">
                                Coronal
                            </label>
                            <input type="range" id="clip-coronal-pos" min="0" max="1" step="0.01" value="0.5" 
                                   oninput="reconstruction3D.setClipPosition('coronal', this.value)">
                            <button class="invert-btn" onclick="reconstruction3D.invertClipPlane('coronal')" title="Invert">⇅</button>
                        </div>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4>📐 Surface Rendering</h4>
                <div class="surface-controls" id="surface-controls" style="display: none;">
                    <div class="slider-row">
                        <label>ISO Value (HU)</label>
                        <input type="range" id="iso-value" min="-1000" max="3000" step="10" value="300" 
                               oninput="reconstruction3D.setIsoValue(this.value)">
                        <span id="iso-value-label">300 HU</span>
                    </div>
                    <div class="color-picker-row">
                        <label>Surface Color</label>
                        <input type="color" id="surface-color" value="#ffe0b8" 
                               onchange="reconstruction3D.setSurfaceColor(this.value)">
                    </div>
                    <div class="slider-row">
                        <label>Opacity</label>
                        <input type="range" id="surface-opacity" min="0" max="1" step="0.05" value="1" 
                               oninput="reconstruction3D.setSurfaceOpacity(this.value)">
                        <span id="surface-opacity-label">100%</span>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <h4>🔧 Transfer Function</h4>
                <button class="btn btn-sm btn-secondary full-width" onclick="reconstruction3D.showTransferFunctionEditor()">
                    ✏️ Edit Transfer Function
                </button>
                <div class="tf-preview" id="tf-preview">
                    <canvas id="tf-preview-canvas" width="200" height="50"></canvas>
                </div>
            </div>

            <div class="panel-section">
                <h4>📷 Export</h4>
                <div class="export-buttons">
                    <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.captureScreenshot()">
                        📸 Screenshot
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.exportVideo()">
                        🎬 Record Video
                    </button>
                    <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.export3DModel()">
                        📦 Export 3D Model
                    </button>
                </div>
            </div>
        `;

        return panel;
    }

    /**
     * Setup 3D viewport event handlers
     */
    setup3DViewportEvents(viewportDiv, index) {
        const element = viewportDiv;
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let dragMode = null;

        // Mouse interactions
        element.addEventListener('mousedown', (e) => {
            if (e.target.closest('.viewport-header-3d, .navigation-cube, .animation-controls')) return;

            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };

            // Determine drag mode based on mouse button
            if (e.button === 0 && !e.ctrlKey && !e.shiftKey) {
                dragMode = 'rotate';
            } else if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
                dragMode = 'pan';
            } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
                dragMode = 'zoom';
            }

            element.classList.add('dragging');
            e.preventDefault();
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            switch (dragMode) {
                case 'rotate':
                    this.rotateCamera(dx, dy);
                    break;
                case 'pan':
                    this.panCamera(dx, dy);
                    break;
                case 'zoom':
                    this.zoomCamera(dy);
                    break;
            }

            dragStart = { x: e.clientX, y: e.clientY };
        });

        element.addEventListener('mouseup', () => {
            isDragging = false;
            dragMode = null;
            element.classList.remove('dragging');
            this.renderFinalQuality();
        });

        element.addEventListener('mouseleave', () => {
            if (isDragging) {
                isDragging = false;
                dragMode = null;
                element.classList.remove('dragging');
                this.renderFinalQuality();
            }
        });

        // Mouse wheel zoom
        element.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? -0.1 : 0.1;
            this.zoomCamera(delta * 100);
        }, { passive: false });

        // Prevent context menu
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
    }

    /**
     * Load volume for 3D rendering
     */
    async loadVolume(studyUid, seriesUid, imageIds) {
        console.log('loadVolume called with', imageIds?.length, 'images');

        if (!this.isInitialized) {
            await this.initialize();
        }

        this.volumeId = `volume-${studyUid}-${seriesUid}`;

        showToast('Loading 3D Volume', 'Processing volume data...', 'info');

        // Show loading message in viewport immediately
        const element = document.getElementById('viewport-element-3d-0');
        if (element) {
            element.innerHTML = '<div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#4a9eff;text-align:center;"><div style="font-size:48px;margin-bottom:10px;">🧊</div><div>Loading 3D Volume...</div></div>';
        }

        try {
            // Hide empty state
            const emptyEl = document.getElementById('viewport-empty-3d-0');
            if (emptyEl) emptyEl.style.display = 'none';

            // Create volume using Cornerstone3D if available
            if (typeof CornerstoneService !== 'undefined' && !window.useFallbackRenderer) {
                const volume = await CornerstoneService.loadVolume(this.volumeId, imageIds);

                if (volume) {
                    // Setup 3D viewport
                    const element = document.getElementById('viewport-element-3d-0');
                    if (element) {
                        this.viewport = await CornerstoneService.create3DViewport('viewport-3d-0', element);
                        await CornerstoneService.setVolumeOnViewports(this.volumeId, ['viewport-3d-0']);
                    }
                }
            } else {
                // Fallback: Use server-side rendering
                await this.loadVolumeFallback(studyUid, seriesUid, imageIds);
            }

            // Apply default preset
            this.applyPreset('ct-bone');

            showToast('3D Volume Loaded', 'Volume rendering ready', 'success');

        } catch (error) {
            console.error('Failed to load 3D volume:', error);
            showToast('Error', 'Failed to load 3D volume', 'error');
        }
    }

    /**
     * Fallback volume loading using SimpleVolumeRenderer or WebGL-based rendering with HU accuracy
     */
    async loadVolumeFallback(studyUid, seriesUid, imageIds) {
        console.log('Loading 3D volume rendering');
        console.log('Study UID:', studyUid);
        console.log('Series UID:', seriesUid);

        this.studyUid = studyUid;
        this.seriesUid = seriesUid;
        this.imageIds = imageIds;
        this.currentRotation = { x: 0, y: 0 };

        // Get viewport element
        const element = document.getElementById('viewport-element-3d-0');
        console.log('Viewport element:', element);

        if (!element) {
            console.error('viewport-element-3d-0 not found!');
            showToast('Error', 'Could not find 3D viewport element', 'error');
            return;
        }

        // Hide empty state
        const emptyEl = document.getElementById('viewport-empty-3d-0');
        if (emptyEl) {
            emptyEl.style.display = 'none';
        }

        // Clear any existing content
        element.innerHTML = '';

        // Set proper styling for the container
        element.style.position = 'relative';
        element.style.width = '100%';
        element.style.height = '100%';

        // Try SimpleVolumeRenderer first (most reliable, no module bundling required)
        if (typeof SimpleVolumeRenderer !== 'undefined') {
            await this.initSimpleRenderer(studyUid, seriesUid, element);
        } else if (typeof WebGLVolumeRenderer !== 'undefined' && typeof VolumeDataLoader !== 'undefined') {
            // Fall back to custom WebGL renderer
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'canvas-3d-webgl';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            element.appendChild(this.canvas);
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            await this.initWebGLRenderer(studyUid, seriesUid);
        } else {
            // Fall back to 2D canvas if no 3D classes available
            console.warn('No 3D renderer classes available, using 2D fallback');
            this.canvas = document.createElement('canvas');
            this.canvas.id = 'canvas-3d-webgl';
            this.canvas.style.width = '100%';
            this.canvas.style.height = '100%';
            this.canvas.style.display = 'block';
            element.appendChild(this.canvas);
            this.resizeCanvas();
            window.addEventListener('resize', () => this.resizeCanvas());
            this.ctx = this.canvas.getContext('2d');
            this.sliceImages = [];
            await this.loadSliceImages();
            this.renderFallback3D();
        }
    }

    /**
     * Initialize SimpleVolumeRenderer for robust 3D volume rendering
     */
    async initSimpleRenderer(studyUid, seriesUid, container) {
        try {
            console.log('Initializing SimpleVolumeRenderer...');
            showToast('Loading 3D Volume', 'Initializing renderer...', 'info');

            // Create Simple renderer
            this.simpleRenderer = new SimpleVolumeRenderer(container);
            await this.simpleRenderer.initialize();

            // First test with synthetic data to verify renderer works
            console.log('Testing renderer with synthetic volume...');
            await this.simpleRenderer.loadTestVolume();
            console.log('Synthetic test volume loaded - if you see a sphere, renderer works!');

            // Brief pause to show test volume
            await new Promise(resolve => setTimeout(resolve, 500));

            // Initialize volume loader
            this.volumeLoader = new VolumeDataLoader();

            // Show loading indicator
            showToast('Loading 3D Volume', 'Fetching volume data...', 'info');

            // Store reference for callbacks
            const self = this;

            // Progressive loading
            const volumeData = await this.volumeLoader.loadVolume(studyUid, seriesUid, {
                progressive: true,
                onProgress: (progress) => {
                    console.log('Volume load progress:', progress);
                    if (progress.phase === 'enhancing' && progress.data) {
                        showToast('Enhancing...', `Loading higher resolution (${progress.sliceCount}/${progress.originalSliceCount} slices)`, 'info');
                        self.updateSimpleVolume(progress.data);
                    } else if (progress.phase === 'complete' && progress.data) {
                        showToast('3D Volume Complete', `Full resolution: ${progress.sliceCount} slices`, 'success');
                        self.updateSimpleVolume(progress.data);
                    }
                }
            });

            if (!volumeData) {
                throw new Error('Failed to load volume data');
            }

            console.log('Volume loaded:', volumeData.dimensions);
            console.log('Volume spacing:', volumeData.spacing);

            // Load volume into Simple renderer
            await this.simpleRenderer.loadVolume(
                volumeData.huVolume,
                volumeData.dimensions,
                volumeData.spacing
            );

            // Apply default preset
            this.simpleRenderer.applyPreset('ct-bone');
            this.renderMode = 'VR';

            // Update UI
            this.updateModeButtons('VR');

            showToast('3D Volume Ready',
                `Loaded: ${volumeData.dimensions.width}×${volumeData.dimensions.height}×${volumeData.dimensions.depth}`,
                'success');

            // Store metadata
            this.volumeMetadata = volumeData.metadata;

            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.simpleRenderer) {
                    this.simpleRenderer.resize();
                }
            });

        } catch (error) {
            console.error('SimpleVolumeRenderer initialization failed:', error);
            showToast('3D Error', error.message, 'error');

            // Try falling back to WebGL renderer
            if (typeof WebGLVolumeRenderer !== 'undefined') {
                console.log('Falling back to WebGL renderer...');
                container.innerHTML = '';
                this.canvas = document.createElement('canvas');
                this.canvas.id = 'canvas-3d-webgl';
                this.canvas.style.width = '100%';
                this.canvas.style.height = '100%';
                this.canvas.style.display = 'block';
                container.appendChild(this.canvas);
                this.resizeCanvas();
                await this.initWebGLRenderer(studyUid, seriesUid);
            }
        }
    }

    /**
     * Update Simple volume with new data (for progressive loading)
     */
    async updateSimpleVolume(volumeData) {
        if (!this.simpleRenderer || !volumeData) return;

        try {
            await this.simpleRenderer.loadVolume(
                volumeData.huVolume,
                volumeData.dimensions,
                volumeData.spacing
            );
        } catch (error) {
            console.error('Failed to update Simple volume:', error);
        }
    }

    /**
     * Update mode buttons in UI
     */
    updateModeButtons(mode) {
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.mode === mode) {
                btn.classList.add('active');
            }
        });
    }

    /**
     * Initialize VTK.js renderer for high-quality volume rendering
     */
    async initVTKRenderer(studyUid, seriesUid, container) {
        try {
            console.log('Initializing VTK.js volume renderer...');
            showToast('Loading 3D Volume', 'Initializing VTK renderer...', 'info');

            // Create VTK renderer
            this.vtkRenderer = new VTKVolumeRenderer(container);
            await this.vtkRenderer.initialize();

            // Initialize volume loader
            this.volumeLoader = new VolumeDataLoader();

            // Show loading indicator
            showToast('Loading 3D Volume', 'Fetching volume data...', 'info');

            // Store reference for callbacks
            const self = this;

            // Progressive loading
            const volumeData = await this.volumeLoader.loadVolume(studyUid, seriesUid, {
                progressive: true,
                onProgress: (progress) => {
                    console.log('Volume load progress:', progress);
                    if (progress.phase === 'enhancing' && progress.data) {
                        showToast('Enhancing...', `Loading higher resolution (${progress.sliceCount}/${progress.originalSliceCount} slices)`, 'info');
                        self.updateVTKVolume(progress.data);
                    } else if (progress.phase === 'complete' && progress.data) {
                        showToast('3D Volume Complete', `Full resolution: ${progress.sliceCount} slices`, 'success');
                        self.updateVTKVolume(progress.data);
                    }
                }
            });

            if (!volumeData) {
                throw new Error('Failed to load volume data');
            }

            console.log('Volume loaded:', volumeData.dimensions);
            console.log('Volume spacing:', volumeData.spacing);

            // Load volume into VTK renderer
            await this.vtkRenderer.loadVolume(
                volumeData.huVolume,
                volumeData.dimensions,
                volumeData.spacing
            );

            // Apply default preset
            this.vtkRenderer.applyPreset('ct-bone');
            this.renderMode = 'VR';

            // Update UI
            this.updateModeButtons('VR');

            showToast('3D Volume Ready',
                `Loaded: ${volumeData.dimensions.width}×${volumeData.dimensions.height}×${volumeData.dimensions.depth}`,
                'success');

            // Store metadata
            this.volumeMetadata = volumeData.metadata;

            // Handle window resize
            window.addEventListener('resize', () => {
                if (this.vtkRenderer) {
                    this.vtkRenderer.resize();
                }
            });

        } catch (error) {
            console.error('VTK renderer initialization failed:', error);
            showToast('3D Error', error.message, 'error');

            // Try falling back to WebGL renderer
            if (typeof WebGLVolumeRenderer !== 'undefined') {
                console.log('Falling back to WebGL renderer...');
                container.innerHTML = '';
                this.canvas = document.createElement('canvas');
                this.canvas.id = 'canvas-3d-webgl';
                this.canvas.style.width = '100%';
                this.canvas.style.height = '100%';
                this.canvas.style.display = 'block';
                container.appendChild(this.canvas);
                this.resizeCanvas();
                await this.initWebGLRenderer(studyUid, seriesUid);
            }
        }
    }


    /**
     * Initialize WebGL renderer with progressive volume loading
     */
    async initWebGLRenderer(studyUid, seriesUid) {
        try {
            // Initialize WebGL renderer
            this.webglRenderer = new WebGLVolumeRenderer(this.canvas);
            await this.webglRenderer.initialize();

            // Check if volume needs downsampling
            const maxDim = this.webglRenderer.getRecommendedMaxDimension();
            console.log('Recommended max dimension:', maxDim);

            // Initialize volume loader
            this.volumeLoader = new VolumeDataLoader();

            // Show loading indicator
            showToast('Loading 3D Volume', 'Fetching volume data...', 'info');

            // Store reference to this for callbacks
            const self = this;

            // Progressive loading: start with low-res
            const volumeData = await this.volumeLoader.loadVolume(studyUid, seriesUid, {
                progressive: true,
                onProgress: (progress) => {
                    console.log('Volume load progress:', progress);
                    if (progress.phase === 'enhancing' && progress.data) {
                        // Update the texture with enhanced data
                        showToast('Enhancing...', `Loading higher resolution (${progress.sliceCount}/${progress.originalSliceCount} slices)`, 'info');
                        self.updateVolumeTexture(progress.data);
                    } else if (progress.phase === 'complete' && progress.data) {
                        showToast('3D Volume Complete', `Full resolution: ${progress.sliceCount} slices`, 'success');
                        self.updateVolumeTexture(progress.data);
                    }
                },
                onEnhancing: (subsample, remaining) => {
                    console.log(`Enhancing: subsample=${subsample}, ${remaining} passes remaining`);
                }
            });

            if (!volumeData) {
                throw new Error('Failed to load volume data');
            }

            console.log('Initial volume loaded:', volumeData.dimensions);
            console.log('Volume spacing:', volumeData.spacing);

            // Check if downsampling is needed
            const { width, height, depth } = volumeData.dimensions;
            let finalData = volumeData.huVolume;
            let finalDimensions = volumeData.dimensions;

            if (this.webglRenderer.needsDownsampling(width, height, depth)) {
                showToast('Downsampling', 'Volume downsampled for GPU compatibility', 'warning');
                const downsampled = this.volumeLoader.downsampleVolume(maxDim);
                finalData = downsampled.data;
                finalDimensions = downsampled.dimensions;
            }

            // Upload to GPU
            this.webglRenderer.uploadVolumeTexture(finalData, finalDimensions);
            this.webglRenderer.volumeSpacing = volumeData.spacing;

            // Start with MIP mode - it's simpler and helps verify data is correct
            this.webglRenderer.setRenderMode('MIP');
            this.renderMode = 'MIP';

            // Apply default transfer function preset
            if (typeof transferFunctionPresets !== 'undefined') {
                const preset = transferFunctionPresets.getPreset('ct-bone');
                if (preset) {
                    this.webglRenderer.setTransferFunction(preset.colorPoints, preset.opacityPoints);
                }
            }

            // Initial render
            console.log('Calling initial render...');
            this.webglRenderer.render();

            showToast('3D Volume Ready', `Loaded: ${finalDimensions.width}×${finalDimensions.height}×${finalDimensions.depth} (MIP mode)`, 'success');

            // Store volume metadata for UI
            this.volumeMetadata = volumeData.metadata;

        } catch (error) {
            console.error('WebGL renderer initialization failed:', error);
            showToast('WebGL Error', error.message, 'error');

            // Fall back to 2D canvas rendering
            console.log('Falling back to 2D canvas rendering');
            this.webglRenderer = null;
            this.ctx = this.canvas.getContext('2d');
            this.sliceImages = [];
            await this.loadSliceImages();
            this.renderFallback3D();
        }
    }

    /**
     * Update volume texture with enhanced data from background loading
     */
    updateVolumeTexture(volumeData) {
        if (!this.webglRenderer || !volumeData) return;

        try {
            const { width, height, depth } = volumeData.dimensions;
            let finalData = volumeData.huVolume;
            let finalDimensions = volumeData.dimensions;

            // Check if downsampling is needed
            const maxDim = this.webglRenderer.getRecommendedMaxDimension();
            if (this.webglRenderer.needsDownsampling(width, height, depth)) {
                console.log('Downsampling enhanced volume...');
                const downsampled = this.volumeLoader.downsampleVolume(maxDim);
                if (downsampled) {
                    finalData = downsampled.data;
                    finalDimensions = downsampled.dimensions;
                }
            }

            // Upload enhanced data to GPU
            console.log(`Updating volume texture: ${finalDimensions.width}×${finalDimensions.height}×${finalDimensions.depth}`);
            this.webglRenderer.uploadVolumeTexture(finalData, finalDimensions);
            this.webglRenderer.render();

            // Update metadata
            this.volumeMetadata = volumeData.metadata;
        } catch (error) {
            console.error('Failed to update volume texture:', error);
        }
    }

    /**
     * Legacy: Fallback volume loading using canvas-based rendering
     */
    async loadVolumeFallbackLegacy(studyUid, seriesUid, imageIds) {
        console.log('Using legacy 2D canvas fallback with', imageIds.length, 'images');

        this.studyUid = studyUid;
        this.seriesUid = seriesUid;
        this.imageIds = imageIds;
        this.sliceImages = [];
        this.currentRotation = { x: 0, y: 0 };

        const element = document.getElementById('viewport-element-3d-0');
        if (!element) {
            console.error('viewport-element-3d-0 not found!');
            showToast('Error', 'Could not find 3D viewport element', 'error');
            return;
        }

        const emptyEl = document.getElementById('viewport-empty-3d-0');
        if (emptyEl) {
            emptyEl.style.display = 'none';
        }

        element.innerHTML = '';

        this.canvas = document.createElement('canvas');
        this.canvas.id = 'canvas-3d-fallback';
        this.canvas.style.width = '100%';
        this.canvas.style.height = '100%';
        this.canvas.style.display = 'block';
        element.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());

        await this.loadSliceImages();
        this.renderFallback3D();
    }

    /**
     * Resize canvas to match container
     */
    resizeCanvas() {
        if (!this.canvas || !this.canvas.parentElement) {
            console.warn('Canvas or parent not available for resize');
            return;
        }
        const rect = this.canvas.parentElement.getBoundingClientRect();
        console.log('Resizing canvas to:', rect.width, 'x', rect.height);

        // Ensure minimum size
        this.canvas.width = Math.max(100, rect.width);
        this.canvas.height = Math.max(100, rect.height);

        // Resize WebGL renderer if available
        if (this.webglRenderer) {
            this.webglRenderer.resize();
            this.webglRenderer.render();
        } else {
            this.renderFallback3D();
        }
    }

    /**
     * Load slice images from server
     */
    async loadSliceImages() {
        if (!this.imageIds || this.imageIds.length === 0) {
            console.warn('No image IDs to load');
            return;
        }

        console.log('Starting to load', this.imageIds.length, 'slices for 3D');

        // Show initial loading state
        if (this.ctx && this.canvas) {
            this.ctx.fillStyle = '#000';
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
            this.ctx.fillStyle = '#4a9eff';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading 3D volume...', this.canvas.width / 2, this.canvas.height / 2);
        }

        // Load a subset of slices for performance (every Nth slice)
        const maxSlices = 50;
        const step = Math.max(1, Math.floor(this.imageIds.length / maxSlices));
        const slicesToLoad = [];

        for (let i = 0; i < this.imageIds.length; i += step) {
            slicesToLoad.push({ imageId: this.imageIds[i], index: i });
        }

        showToast('Loading 3D', `Loading ${slicesToLoad.length} slices...`, 'info');

        // Load images with progress updates
        let loaded = 0;
        let failed = 0;

        for (const { imageId, index } of slicesToLoad) {
            try {
                const img = await this.loadSingleSlice(imageId);
                if (img) {
                    this.sliceImages.push({ img, index });
                    loaded++;

                    // Update progress display
                    if (this.ctx && this.canvas) {
                        const progress = Math.round((loaded / slicesToLoad.length) * 100);
                        this.ctx.fillStyle = '#000';
                        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
                        this.ctx.fillStyle = '#4a9eff';
                        this.ctx.font = '16px sans-serif';
                        this.ctx.textAlign = 'center';
                        this.ctx.fillText(`Loading 3D volume... ${progress}%`, this.canvas.width / 2, this.canvas.height / 2);
                        this.ctx.fillText(`(${loaded}/${slicesToLoad.length} slices)`, this.canvas.width / 2, this.canvas.height / 2 + 25);
                    }

                    // Render preview periodically
                    if (loaded % 5 === 0 && this.sliceImages.length >= 3) {
                        // Sort by index for correct order
                        this.sliceImages.sort((a, b) => a.index - b.index);
                        this.renderFallback3D();
                    }
                }
            } catch (e) {
                console.warn('Failed to load slice:', imageId, e.message);
                failed++;
            }
        }

        // Sort slices by index for correct order
        this.sliceImages.sort((a, b) => a.index - b.index);

        // Extract just the images
        this.sliceImages = this.sliceImages.map(s => s.img);

        console.log('Loaded', this.sliceImages.length, 'slices for 3D rendering,', failed, 'failed');

        if (this.sliceImages.length > 0) {
            showToast('3D Ready', `Loaded ${this.sliceImages.length} slices`, 'success');
            this.renderFallback3D();
        } else {
            showToast('3D Error', 'Failed to load any slices', 'error');
        }
    }

    /**
     * Load a single slice image
     */
    async loadSingleSlice(imageId) {
        return new Promise(async (resolve, reject) => {
            try {
                // Parse imageId to get URL
                const match = imageId.match(/wadouri:(.+)/);
                if (!match) {
                    reject(new Error('Invalid imageId'));
                    return;
                }

                const url = new URL(match[1], window.location.origin);
                const studyUid = url.searchParams.get('studyUID');
                const seriesUid = url.searchParams.get('seriesUID');
                const instanceUid = url.searchParams.get('objectUID');

                if (!studyUid || !seriesUid || !instanceUid) {
                    reject(new Error('Missing UIDs'));
                    return;
                }

                // Get rendered image using the API client
                const response = await api.getRenderedInstance(studyUid, seriesUid, instanceUid, {
                    window: 400,
                    level: 40
                });

                if (response.status === 202) {
                    // Image is being retrieved from PACS, retry after delay
                    setTimeout(async () => {
                        try {
                            const img = await this.loadSingleSlice(imageId);
                            resolve(img);
                        } catch (e) {
                            reject(e);
                        }
                    }, 1000);
                    return;
                }

                if (!response.ok) {
                    reject(new Error(`HTTP ${response.status}`));
                    return;
                }

                const blob = await response.blob();
                const imgUrl = URL.createObjectURL(blob);

                const img = new Image();
                img.onload = () => {
                    URL.revokeObjectURL(imgUrl);
                    resolve(img);
                };
                img.onerror = () => {
                    URL.revokeObjectURL(imgUrl);
                    reject(new Error('Failed to load image'));
                };
                img.src = imgUrl;
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Render fallback 3D view using canvas
     */
    renderFallback3D() {
        if (!this.ctx || !this.canvas) return;

        const { width, height } = this.canvas;

        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);

        if (this.sliceImages.length === 0) {
            // Show loading message
            this.ctx.fillStyle = '#666';
            this.ctx.font = '16px sans-serif';
            this.ctx.textAlign = 'center';
            this.ctx.fillText('Loading volume data...', width / 2, height / 2);
            return;
        }

        // Render based on mode
        switch (this.renderMode) {
            case 'MIP':
                this.renderMIP();
                break;
            case 'MinIP':
                this.renderMinIP();
                break;
            case 'AIP':
                this.renderAIP();
                break;
            case 'VR':
            case 'Surface':
            default:
                this.render3DStack();
                break;
        }

        // Draw info overlay
        this.ctx.fillStyle = '#4a9eff';
        this.ctx.font = '12px sans-serif';
        this.ctx.textAlign = 'left';
        this.ctx.fillText(`Mode: ${this.renderMode} | Slices: ${this.sliceImages.length}`, 10, height - 10);
    }

    /**
     * Render Maximum Intensity Projection
     */
    renderMIP() {
        if (!this.sliceImages || this.sliceImages.length === 0) return;

        // Check first image is valid
        const firstImg = this.sliceImages[0];
        if (!firstImg || !firstImg.width) return;

        const imgWidth = firstImg.width;
        const imgHeight = firstImg.height;

        // Create temporary canvas for compositing
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Initialize with first slice
        tempCtx.drawImage(firstImg, 0, 0);
        const resultData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);

        // MIP: Take maximum value from each slice
        for (let i = 1; i < this.sliceImages.length; i++) {
            const slice = this.sliceImages[i];
            if (!slice || !slice.width) continue;

            tempCtx.drawImage(slice, 0, 0);
            const sliceData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);

            for (let j = 0; j < resultData.data.length; j += 4) {
                // Take maximum of R, G, B channels
                resultData.data[j] = Math.max(resultData.data[j], sliceData.data[j]);
                resultData.data[j + 1] = Math.max(resultData.data[j + 1], sliceData.data[j + 1]);
                resultData.data[j + 2] = Math.max(resultData.data[j + 2], sliceData.data[j + 2]);
            }
        }

        // Put result back
        tempCtx.putImageData(resultData, 0, 0);

        // Draw to main canvas with scaling and rotation
        this.drawWithTransform(tempCanvas);
    }

    /**
     * Render Minimum Intensity Projection
     */
    renderMinIP() {
        if (this.sliceImages.length === 0) return;

        const imgWidth = this.sliceImages[0].width;
        const imgHeight = this.sliceImages[0].height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d');

        tempCtx.drawImage(this.sliceImages[0], 0, 0);
        const resultData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);

        // MinIP: Take minimum value from each slice
        for (let i = 1; i < this.sliceImages.length; i++) {
            tempCtx.drawImage(this.sliceImages[i], 0, 0);
            const sliceData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);

            for (let j = 0; j < resultData.data.length; j += 4) {
                resultData.data[j] = Math.min(resultData.data[j], sliceData.data[j]);
                resultData.data[j + 1] = Math.min(resultData.data[j + 1], sliceData.data[j + 1]);
                resultData.data[j + 2] = Math.min(resultData.data[j + 2], sliceData.data[j + 2]);
            }
        }

        tempCtx.putImageData(resultData, 0, 0);
        this.drawWithTransform(tempCanvas);
    }

    /**
     * Render Average Intensity Projection
     */
    renderAIP() {
        if (this.sliceImages.length === 0) return;

        const imgWidth = this.sliceImages[0].width;
        const imgHeight = this.sliceImages[0].height;

        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = imgWidth;
        tempCanvas.height = imgHeight;
        const tempCtx = tempCanvas.getContext('2d');

        // Use accumulator for averaging
        const accumulator = new Float32Array(imgWidth * imgHeight * 4);

        for (let i = 0; i < this.sliceImages.length; i++) {
            tempCtx.drawImage(this.sliceImages[i], 0, 0);
            const sliceData = tempCtx.getImageData(0, 0, imgWidth, imgHeight);

            for (let j = 0; j < sliceData.data.length; j++) {
                accumulator[j] += sliceData.data[j];
            }
        }

        // Average
        const resultData = tempCtx.createImageData(imgWidth, imgHeight);
        const count = this.sliceImages.length;
        for (let j = 0; j < resultData.data.length; j += 4) {
            resultData.data[j] = Math.round(accumulator[j] / count);
            resultData.data[j + 1] = Math.round(accumulator[j + 1] / count);
            resultData.data[j + 2] = Math.round(accumulator[j + 2] / count);
            resultData.data[j + 3] = 255;
        }

        tempCtx.putImageData(resultData, 0, 0);
        this.drawWithTransform(tempCanvas);
    }

    /**
     * Render 3D stack visualization (pseudo-3D)
     */
    render3DStack() {
        if (!this.sliceImages || this.sliceImages.length === 0) return;

        // Check first image is valid
        const firstImg = this.sliceImages[0];
        if (!firstImg || !firstImg.width) return;

        const { width, height } = this.canvas;
        const rotX = this.currentRotation?.x || 0;
        const rotY = this.currentRotation?.y || 0;

        // Calculate slice spacing based on rotation
        const spacing = 2;
        const offsetX = Math.sin(rotY * Math.PI / 180) * spacing;
        const offsetY = Math.sin(rotX * Math.PI / 180) * spacing;

        // Calculate scale to fit
        const scale = Math.min(width / (firstImg.width + Math.abs(offsetX) * this.sliceImages.length),
                               height / (firstImg.height + Math.abs(offsetY) * this.sliceImages.length)) * 0.8 * this.camera.zoom;

        // Draw slices from back to front
        const startIdx = rotY > 0 ? 0 : this.sliceImages.length - 1;
        const endIdx = rotY > 0 ? this.sliceImages.length : -1;
        const step = rotY > 0 ? 1 : -1;

        this.ctx.save();
        this.ctx.translate(width / 2, height / 2);

        for (let i = startIdx; i !== endIdx; i += step) {
            const slice = this.sliceImages[i];
            if (!slice || !slice.width) continue;

            const depth = i - this.sliceImages.length / 2;

            const x = depth * offsetX - (slice.width * scale) / 2;
            const y = depth * offsetY - (slice.height * scale) / 2;

            // Apply slight opacity for depth effect
            const alpha = 0.3 + 0.7 * (1 - Math.abs(depth) / (this.sliceImages.length / 2));
            this.ctx.globalAlpha = Math.max(0.1, Math.min(1, alpha));

            this.ctx.drawImage(slice, x, y, slice.width * scale, slice.height * scale);
        }

        this.ctx.restore();
        this.ctx.globalAlpha = 1;
    }

    /**
     * Draw image with current transform (zoom, rotation)
     */
    drawWithTransform(sourceCanvas) {
        const { width, height } = this.canvas;
        const scale = Math.min(width / sourceCanvas.width, height / sourceCanvas.height) * 0.9 * this.camera.zoom;

        const drawWidth = sourceCanvas.width * scale;
        const drawHeight = sourceCanvas.height * scale;

        this.ctx.save();
        this.ctx.translate(width / 2, height / 2);
        this.ctx.rotate((this.currentRotation.y || 0) * Math.PI / 180);
        this.ctx.drawImage(sourceCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        this.ctx.restore();
    }

    /**
     * Request server-side 3D render (for fallback mode)
     */
    async requestServerRender() {
        // This would call a server endpoint that uses VTK or similar for rendering
        console.log('Requesting server-side 3D render');
    }

    /**
     * Set rendering mode
     */
    setRenderMode(mode) {
        this.renderMode = mode;

        // Update UI
        document.querySelectorAll('.mode-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.mode === mode);
        });

        // Update overlay
        const modeLabel = document.getElementById('overlay-3d-mode');
        if (modeLabel) modeLabel.textContent = mode;

        // Show/hide surface controls
        const surfaceControls = document.getElementById('surface-controls');
        if (surfaceControls) {
            surfaceControls.style.display = mode === 'Surface' ? 'block' : 'none';
        }

        // Apply mode to SimpleVolumeRenderer (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.setRenderMode(mode);
            showToast(`${mode} Mode`, `Switched to ${mode} rendering`, 'info');
            return;
        }

        // Apply mode to VTK renderer (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.setRenderMode(mode);
            showToast(`${mode} Mode`, `Switched to ${mode} rendering`, 'info');
            return;
        }

        // Apply mode to WebGL renderer (fallback)
        if (this.webglRenderer) {
            this.webglRenderer.setRenderMode(mode);
            this.webglRenderer.render();
            showToast(`${mode} Mode`, `Switched to ${mode} rendering`, 'info');
            return;
        }

        // Apply mode to viewport (Cornerstone3D)
        if (this.viewport) {
            switch (mode) {
                case 'VR':
                    this.setVolumeRenderingMode();
                    break;
                case 'MIP':
                    this.setMIPMode();
                    break;
                case 'MinIP':
                    this.setMinIPMode();
                    break;
                case 'AIP':
                    this.setAIPMode();
                    break;
                case 'Surface':
                    this.setSurfaceRenderingMode();
                    break;
            }
        } else if (this.canvas) {
            // Fallback renderer - just re-render with new mode
            this.renderFallback3D();
        }

        showToast(`${mode} Mode`, `Switched to ${mode} rendering`, 'info');
    }

    /**
     * Set Volume Rendering mode
     */
    setVolumeRenderingMode() {
        if (!this.viewport) return;

        // Set blend mode to composite
        if (this.viewport.setBlendMode) {
            this.viewport.setBlendMode('COMPOSITE');
        }

        // Apply transfer function
        this.applyTransferFunction();

        this.render();
    }

    /**
     * Set MIP (Maximum Intensity Projection) mode
     */
    setMIPMode() {
        if (!this.viewport) return;

        if (this.viewport.setBlendMode) {
            this.viewport.setBlendMode('MAXIMUM_INTENSITY_BLEND');
        }

        this.render();
    }

    /**
     * Set MinIP (Minimum Intensity Projection) mode
     */
    setMinIPMode() {
        if (!this.viewport) return;

        if (this.viewport.setBlendMode) {
            this.viewport.setBlendMode('MINIMUM_INTENSITY_BLEND');
        }

        this.render();
    }

    /**
     * Set AIP (Average Intensity Projection) mode
     */
    setAIPMode() {
        if (!this.viewport) return;

        if (this.viewport.setBlendMode) {
            this.viewport.setBlendMode('AVERAGE_INTENSITY_BLEND');
        }

        this.render();
    }

    /**
     * Set Surface Rendering mode
     */
    setSurfaceRenderingMode() {
        if (!this.viewport) return;

        // Surface rendering uses isosurface extraction
        const isoValue = parseFloat(document.getElementById('iso-value')?.value || 300);
        this.setIsoValue(isoValue);

        this.render();
    }

    /**
     * Apply preset
     */
    applyPreset(presetName) {
        // Try new transfer function presets first
        let preset = null;
        if (typeof transferFunctionPresets !== 'undefined') {
            preset = transferFunctionPresets.getPreset(presetName);
        }

        // Fall back to old presets
        if (!preset) {
            preset = this.presets[presetName];
        }

        if (!preset) {
            console.warn('Preset not found:', presetName);
            return;
        }

        console.log('Applying preset:', presetName, preset);

        // Update render mode
        if (preset.renderMode) {
            this.setRenderMode(preset.renderMode);
        }

        // Apply preset to SimpleVolumeRenderer (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.applyPreset(presetName);
            showToast(`Preset Applied`, `${preset.name || presetName}`, 'success');
            return;
        }
        // Apply preset to VTK renderer (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.applyPreset(presetName);
            showToast(`Preset Applied`, `${preset.name || presetName}`, 'success');
        }
        // Apply transfer function to WebGL renderer (fallback)
        else if (this.webglRenderer && preset.colorPoints && preset.opacityPoints) {
            this.webglRenderer.setTransferFunction(preset.colorPoints, preset.opacityPoints);
            this.transferFunction.colorPoints = preset.colorPoints;
            this.transferFunction.opacityPoints = preset.opacityPoints;
        }
        // Apply transfer function (legacy format)
        else if (preset.transferFunction) {
            this.transferFunction.opacityPoints = preset.transferFunction.opacityPoints;
            this.transferFunction.colorPoints = preset.transferFunction.colorPoints;

            if (this.webglRenderer) {
                // Convert legacy format to new format
                const colorPoints = preset.transferFunction.colorPoints.map(p => ({
                    hu: p.value,
                    r: p.color[0],
                    g: p.color[1],
                    b: p.color[2]
                }));
                const opacityPoints = preset.transferFunction.opacityPoints.map(p => ({
                    hu: p.value,
                    opacity: p.opacity
                }));
                this.webglRenderer.setTransferFunction(colorPoints, opacityPoints);
            }

            this.applyTransferFunction();
        }

        // Apply window/level for projections
        if (preset.windowCenter !== undefined && preset.windowWidth !== undefined) {
            if (this.viewport && this.viewport.setProperties) {
                this.viewport.setProperties({
                    voiRange: {
                        lower: preset.windowCenter - preset.windowWidth / 2,
                        upper: preset.windowCenter + preset.windowWidth / 2
                    }
                });
            }
        }

        // Apply surface rendering settings
        if (preset.isoValue !== undefined) {
            this.setIsoValue(preset.isoValue);
        }

        // Apply shading settings
        if (preset.shadingEnabled !== undefined) {
            this.toggleShading(preset.shadingEnabled);
            const shadingCheckbox = document.getElementById('shading-enabled');
            if (shadingCheckbox) shadingCheckbox.checked = preset.shadingEnabled;
        }

        // Update preset dropdown
        const presetSelect = document.getElementById('preset-select-3d');
        if (presetSelect) presetSelect.value = presetName;

        // Update overlay
        const presetLabel = document.getElementById('overlay-3d-preset');
        if (presetLabel) presetLabel.textContent = preset.name;

        this.render();
        showToast(preset.name, preset.description || '', 'info');
    }

    /**
     * Apply transfer function
     */
    applyTransferFunction() {
        // Apply to WebGL renderer if available
        if (this.webglRenderer) {
            this.webglRenderer.setTransferFunction(
                this.transferFunction.colorPoints,
                this.transferFunction.opacityPoints
            );
            this.webglRenderer.render();
        }

        if (this.viewport) {
            // Build color and opacity lookup tables
            // This would interface with Cornerstone3D's volume actor properties
        }

        this.updateTransferFunctionPreview();
        this.render();
    }

    /**
     * Update transfer function preview canvas
     */
    updateTransferFunctionPreview() {
        const canvas = document.getElementById('tf-preview-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Draw color gradient
        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        this.transferFunction.colorPoints.forEach((point, i) => {
            const stop = (point.value + 1000) / 4000; // Normalize to 0-1
            const color = `rgb(${point.color.join(',')})`;
            gradient.addColorStop(Math.max(0, Math.min(1, stop)), color);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, height / 2, width, height / 2);

        // Draw opacity curve
        ctx.beginPath();
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;

        this.transferFunction.opacityPoints.forEach((point, i) => {
            const x = ((point.value + 1000) / 4000) * width;
            const y = height / 2 - (point.opacity * (height / 2 - 5));

            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        });

        ctx.stroke();

        // Draw opacity points
        ctx.fillStyle = '#fff';
        this.transferFunction.opacityPoints.forEach(point => {
            const x = ((point.value + 1000) / 4000) * width;
            const y = height / 2 - (point.opacity * (height / 2 - 5));
            ctx.beginPath();
            ctx.arc(x, y, 4, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Show transfer function editor modal
     */
    showTransferFunctionEditor() {
        // Create or show modal
        let modal = document.getElementById('tfEditorModal');
        if (!modal) {
            modal = this.createTransferFunctionEditorModal();
            document.body.appendChild(modal);
        }
        modal.style.display = 'flex';
        this.initTransferFunctionEditor();
    }

    /**
     * Create transfer function editor modal
     */
    createTransferFunctionEditorModal() {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = 'tfEditorModal';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 900px;">
                <div class="modal-header">
                    <h3>🎨 Transfer Function Editor</h3>
                    <button class="btn-icon" onclick="reconstruction3D.hideTransferFunctionEditor()">✕</button>
                </div>
                <div class="modal-body">
                    <div class="tf-editor">
                        <!-- HU Value Histogram -->
                        <div class="tf-section">
                            <h5>Volume Histogram</h5>
                            <div class="tf-histogram-container">
                                <canvas id="tf-histogram" width="800" height="80"></canvas>
                            </div>
                        </div>
                        
                        <!-- Combined Color & Opacity Editor -->
                        <div class="tf-section">
                            <h5>Color & Opacity Curve</h5>
                            <div class="tf-editor-container" style="position: relative;">
                                <canvas id="tf-editor-canvas" width="800" height="200"></canvas>
                                <div class="tf-axis-labels">
                                    <span class="tf-axis-min">-1024 HU</span>
                                    <span class="tf-axis-center">0 HU</span>
                                    <span class="tf-axis-max">3071 HU</span>
                                </div>
                            </div>
                            <p class="tf-hint">Click to add points. Drag to move. Right-click to delete.</p>
                        </div>
                        
                        <!-- Control Points Table -->
                        <div class="tf-section">
                            <h5>Control Points</h5>
                            <div class="tf-points-table" id="tf-points-table">
                                <!-- Dynamic content -->
                            </div>
                            <div class="tf-point-actions">
                                <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.addControlPoint()">+ Add Point</button>
                                <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.resetTransferFunction()">Reset to Default</button>
                            </div>
                        </div>
                        
                        <!-- Preset Selection -->
                        <div class="tf-section">
                            <h5>Presets</h5>
                            <div class="tf-controls">
                                <div class="tf-control-group">
                                    <label>Built-in Presets</label>
                                    <select id="tf-preset-select" class="form-input" onchange="reconstruction3D.applyTFPresetFromEditor(this.value)">
                                        <option value="">Select preset...</option>
                                        <optgroup label="CT">
                                            <option value="ct-bone">Bone</option>
                                            <option value="ct-soft-tissue">Soft Tissue</option>
                                            <option value="ct-lung">Lung</option>
                                            <option value="ct-vascular">Vascular (CTA)</option>
                                            <option value="ct-cardiac">Cardiac</option>
                                            <option value="ct-skin">Skin Surface</option>
                                        </optgroup>
                                        <optgroup label="MR">
                                            <option value="mr-brain">Brain</option>
                                        </optgroup>
                                        <optgroup label="General">
                                            <option value="grayscale">Grayscale</option>
                                            <option value="hot-iron">Hot Iron</option>
                                        </optgroup>
                                    </select>
                                </div>
                                <div class="tf-control-group">
                                    <label>Custom Presets</label>
                                    <select id="tf-custom-preset-select" class="form-input" onchange="reconstruction3D.applyTFPresetFromEditor(this.value)">
                                        <option value="">Select custom preset...</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                        
                        <!-- Import/Export -->
                        <div class="tf-section">
                            <h5>Import / Export</h5>
                            <div class="tf-import-export">
                                <input type="file" id="tf-import-file" accept=".json,.xml,.ctbl" style="display:none" onchange="reconstruction3D.handleTFImport(this)">
                                <button class="btn btn-sm btn-secondary" onclick="document.getElementById('tf-import-file').click()">
                                    📥 Import (JSON/VTK/Slicer)
                                </button>
                                <button class="btn btn-sm btn-secondary" onclick="reconstruction3D.exportCurrentTF()">
                                    📤 Export JSON
                                </button>
                                <button class="btn btn-sm btn-primary" onclick="reconstruction3D.saveAsCustomPreset()">
                                    💾 Save as Preset
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <button class="btn btn-secondary" onclick="reconstruction3D.hideTransferFunctionEditor()">Cancel</button>
                    <button class="btn btn-primary" onclick="reconstruction3D.applyAndCloseTransferFunctionEditor()">Apply</button>
                </div>
            </div>
        `;

        // Add CSS for the new editor
        this.addTransferFunctionEditorStyles();

        return modal;
    }

    /**
     * Add CSS styles for the transfer function editor
     */
    addTransferFunctionEditorStyles() {
        if (document.getElementById('tf-editor-styles')) return;

        const style = document.createElement('style');
        style.id = 'tf-editor-styles';
        style.textContent = `
            .tf-editor {
                display: flex;
                flex-direction: column;
                gap: 15px;
            }
            .tf-section {
                background: rgba(0, 0, 0, 0.2);
                padding: 12px;
                border-radius: 8px;
            }
            .tf-section h5 {
                margin: 0 0 10px 0;
                color: #4a9eff;
                font-size: 13px;
            }
            .tf-histogram-container, .tf-editor-container {
                background: #1a1a2e;
                border-radius: 4px;
                overflow: hidden;
            }
            .tf-editor-container {
                position: relative;
            }
            .tf-axis-labels {
                display: flex;
                justify-content: space-between;
                padding: 4px 8px;
                font-size: 11px;
                color: #888;
            }
            .tf-hint {
                font-size: 11px;
                color: #666;
                margin: 5px 0 0 0;
            }
            .tf-controls {
                display: flex;
                gap: 15px;
                flex-wrap: wrap;
            }
            .tf-control-group {
                flex: 1;
                min-width: 200px;
            }
            .tf-control-group label {
                display: block;
                font-size: 12px;
                color: #aaa;
                margin-bottom: 4px;
            }
            .tf-points-table {
                max-height: 150px;
                overflow-y: auto;
                font-size: 12px;
            }
            .tf-point-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 4px 0;
                border-bottom: 1px solid #333;
            }
            .tf-point-row input[type="number"] {
                width: 70px;
                padding: 4px;
                background: #1a1a2e;
                border: 1px solid #333;
                border-radius: 4px;
                color: #fff;
            }
            .tf-point-row input[type="color"] {
                width: 40px;
                height: 24px;
                padding: 0;
                border: none;
                cursor: pointer;
            }
            .tf-point-row .tf-delete-btn {
                background: #ff4444;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 2px 8px;
                cursor: pointer;
            }
            .tf-point-actions {
                display: flex;
                gap: 10px;
                margin-top: 10px;
            }
            .tf-import-export {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
        `;
        document.head.appendChild(style);
    }

    /**
     * Initialize transfer function editor with interactive canvas
     */
    initTransferFunctionEditor() {
        this.updateControlPointsTable();
        this.setupEditorCanvasInteraction();
        this.drawTransferFunctionEditor();
        this.updateCustomPresetSelect();
    }

    /**
     * Setup canvas interaction for dragging points
     */
    setupEditorCanvasInteraction() {
        const canvas = document.getElementById('tf-editor-canvas');
        if (!canvas || canvas._hasListeners) return;

        canvas._hasListeners = true;
        let draggingPoint = null;
        let dragType = null; // 'opacity' or 'color'

        const huMin = -1024;
        const huMax = 3071;
        const huRange = huMax - huMin;

        const getHUFromX = (x) => (x / canvas.width) * huRange + huMin;
        const getOpacityFromY = (y) => 1 - (y / canvas.height);

        canvas.addEventListener('mousedown', (e) => {
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const hu = getHUFromX(x);

            // Check if clicking near an existing point
            const points = this.transferFunction.opacityPoints;
            for (let i = 0; i < points.length; i++) {
                const px = ((points[i].hu || points[i].value) - huMin) / huRange * canvas.width;
                const py = (1 - points[i].opacity) * canvas.height;
                if (Math.abs(px - x) < 10 && Math.abs(py - y) < 10) {
                    draggingPoint = i;
                    dragType = 'opacity';
                    return;
                }
            }

            // Add new point on click
            if (e.button === 0) {
                const newHU = Math.round(hu);
                const newOpacity = Math.max(0, Math.min(1, getOpacityFromY(y)));
                this.addControlPointAt(newHU, newOpacity);
            }
        });

        canvas.addEventListener('mousemove', (e) => {
            if (draggingPoint === null) return;

            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            const points = this.transferFunction.opacityPoints;
            const newHU = Math.round(getHUFromX(x));
            const newOpacity = Math.max(0, Math.min(1, getOpacityFromY(y)));

            if (points[draggingPoint].hu !== undefined) {
                points[draggingPoint].hu = newHU;
            } else {
                points[draggingPoint].value = newHU;
            }
            points[draggingPoint].opacity = newOpacity;

            // Also update color point at same index if exists
            const colorPoints = this.transferFunction.colorPoints;
            if (colorPoints[draggingPoint]) {
                if (colorPoints[draggingPoint].hu !== undefined) {
                    colorPoints[draggingPoint].hu = newHU;
                } else {
                    colorPoints[draggingPoint].value = newHU;
                }
            }

            this.drawTransferFunctionEditor();
            this.updateControlPointsTable();
        });

        canvas.addEventListener('mouseup', () => {
            if (draggingPoint !== null) {
                draggingPoint = null;
                this.applyTransferFunction();
            }
        });

        canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;

            const points = this.transferFunction.opacityPoints;
            for (let i = 0; i < points.length; i++) {
                const px = ((points[i].hu || points[i].value) - huMin) / huRange * canvas.width;
                if (Math.abs(px - x) < 10 && points.length > 2) {
                    this.removeControlPoint(i);
                    return;
                }
            }
        });
    }

    /**
     * Draw the transfer function editor canvas
     */
    drawTransferFunctionEditor() {
        const canvas = document.getElementById('tf-editor-canvas');
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const width = canvas.width;
        const height = canvas.height;

        // Clear
        ctx.fillStyle = '#1a1a2e';
        ctx.fillRect(0, 0, width, height);

        // Draw grid
        ctx.strokeStyle = '#2a2a3e';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 10; i++) {
            const x = (i / 10) * width;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        for (let i = 0; i <= 4; i++) {
            const y = (i / 4) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw color gradient at bottom
        const huMin = -1024;
        const huMax = 3071;
        const huRange = huMax - huMin;
        const colorPoints = this.transferFunction.colorPoints;

        const gradient = ctx.createLinearGradient(0, 0, width, 0);
        colorPoints.forEach(point => {
            const hu = point.hu !== undefined ? point.hu : point.value;
            const stop = (hu - huMin) / huRange;
            const r = point.r !== undefined ? point.r : (point.color ? point.color[0] : 128);
            const g = point.g !== undefined ? point.g : (point.color ? point.color[1] : 128);
            const b = point.b !== undefined ? point.b : (point.color ? point.color[2] : 128);
            gradient.addColorStop(Math.max(0, Math.min(1, stop)), `rgb(${r},${g},${b})`);
        });

        ctx.fillStyle = gradient;
        ctx.fillRect(0, height - 20, width, 20);

        // Draw opacity curve
        const opacityPoints = this.transferFunction.opacityPoints;
        ctx.beginPath();
        ctx.strokeStyle = '#4a9eff';
        ctx.lineWidth = 2;

        opacityPoints.forEach((point, i) => {
            const hu = point.hu !== undefined ? point.hu : point.value;
            const x = ((hu - huMin) / huRange) * width;
            const y = (1 - point.opacity) * (height - 20);

            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        });
        ctx.stroke();

        // Draw control points
        opacityPoints.forEach((point, i) => {
            const hu = point.hu !== undefined ? point.hu : point.value;
            const x = ((hu - huMin) / huRange) * width;
            const y = (1 - point.opacity) * (height - 20);

            // Get color at this point
            const color = this.getColorAtHU(hu);

            ctx.beginPath();
            ctx.fillStyle = '#fff';
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fill();

            ctx.beginPath();
            ctx.fillStyle = `rgb(${color.r},${color.g},${color.b})`;
            ctx.arc(x, y, 5, 0, Math.PI * 2);
            ctx.fill();
        });
    }

    /**
     * Get interpolated color at a specific HU value
     */
    getColorAtHU(hu) {
        const points = this.transferFunction.colorPoints;

        for (let i = 0; i < points.length - 1; i++) {
            const hu1 = points[i].hu !== undefined ? points[i].hu : points[i].value;
            const hu2 = points[i + 1].hu !== undefined ? points[i + 1].hu : points[i + 1].value;

            if (hu >= hu1 && hu <= hu2) {
                const t = (hu - hu1) / (hu2 - hu1);
                const r1 = points[i].r !== undefined ? points[i].r : (points[i].color ? points[i].color[0] : 0);
                const g1 = points[i].g !== undefined ? points[i].g : (points[i].color ? points[i].color[1] : 0);
                const b1 = points[i].b !== undefined ? points[i].b : (points[i].color ? points[i].color[2] : 0);
                const r2 = points[i + 1].r !== undefined ? points[i + 1].r : (points[i + 1].color ? points[i + 1].color[0] : 255);
                const g2 = points[i + 1].g !== undefined ? points[i + 1].g : (points[i + 1].color ? points[i + 1].color[1] : 255);
                const b2 = points[i + 1].b !== undefined ? points[i + 1].b : (points[i + 1].color ? points[i + 1].color[2] : 255);

                return {
                    r: Math.round(r1 + t * (r2 - r1)),
                    g: Math.round(g1 + t * (g2 - g1)),
                    b: Math.round(b1 + t * (b2 - b1))
                };
            }
        }

        return { r: 128, g: 128, b: 128 };
    }

    /**
     * Update control points table
     */
    updateControlPointsTable() {
        const table = document.getElementById('tf-points-table');
        if (!table) return;

        const points = this.transferFunction.opacityPoints;
        const colorPoints = this.transferFunction.colorPoints;

        let html = `
            <div class="tf-point-row" style="font-weight: bold; color: #888;">
                <span style="width: 30px;">#</span>
                <span style="width: 80px;">HU Value</span>
                <span style="width: 80px;">Opacity</span>
                <span style="width: 50px;">Color</span>
                <span style="width: 50px;"></span>
            </div>
        `;

        points.forEach((point, i) => {
            const hu = point.hu !== undefined ? point.hu : point.value;
            const color = colorPoints[i] ? this.rgbToHex(
                colorPoints[i].r !== undefined ? colorPoints[i].r : (colorPoints[i].color ? colorPoints[i].color[0] : 128),
                colorPoints[i].g !== undefined ? colorPoints[i].g : (colorPoints[i].color ? colorPoints[i].color[1] : 128),
                colorPoints[i].b !== undefined ? colorPoints[i].b : (colorPoints[i].color ? colorPoints[i].color[2] : 128)
            ) : '#808080';

            html += `
                <div class="tf-point-row">
                    <span style="width: 30px; color: #666;">${i + 1}</span>
                    <input type="number" value="${hu}" min="-1024" max="3071" onchange="reconstruction3D.updatePointHU(${i}, this.value)">
                    <input type="number" value="${point.opacity.toFixed(2)}" min="0" max="1" step="0.05" onchange="reconstruction3D.updatePointOpacity(${i}, this.value)">
                    <input type="color" value="${color}" onchange="reconstruction3D.updatePointColor(${i}, this.value)">
                    ${points.length > 2 ? `<button class="tf-delete-btn" onclick="reconstruction3D.removeControlPoint(${i})">×</button>` : '<span style="width: 50px;"></span>'}
                </div>
            `;
        });

        table.innerHTML = html;
    }

    /**
     * Helper to convert RGB to hex
     */
    rgbToHex(r, g, b) {
        return '#' + [r, g, b].map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
    }

    /**
     * Add control point at specific HU and opacity
     */
    addControlPointAt(hu, opacity) {
        // Find position to insert (sorted by HU)
        const points = this.transferFunction.opacityPoints;
        let insertIndex = points.length;

        for (let i = 0; i < points.length; i++) {
            const pointHU = points[i].hu !== undefined ? points[i].hu : points[i].value;
            if (hu < pointHU) {
                insertIndex = i;
                break;
            }
        }

        // Get interpolated color
        const color = this.getColorAtHU(hu);

        // Insert opacity point
        const newOpacityPoint = { hu, opacity };
        points.splice(insertIndex, 0, newOpacityPoint);

        // Insert color point
        const newColorPoint = { hu, r: color.r, g: color.g, b: color.b };
        this.transferFunction.colorPoints.splice(insertIndex, 0, newColorPoint);

        this.updateControlPointsTable();
        this.drawTransferFunctionEditor();
        this.applyTransferFunction();
    }

    /**
     * Add control point (button handler)
     */
    addControlPoint() {
        this.addControlPointAt(500, 0.5);
    }

    /**
     * Remove control point
     */
    removeControlPoint(index) {
        if (this.transferFunction.opacityPoints.length <= 2) return;

        this.transferFunction.opacityPoints.splice(index, 1);
        this.transferFunction.colorPoints.splice(index, 1);

        this.updateControlPointsTable();
        this.drawTransferFunctionEditor();
        this.applyTransferFunction();
    }

    /**
     * Update point HU value
     */
    updatePointHU(index, value) {
        const hu = parseInt(value);
        const points = this.transferFunction.opacityPoints;
        const colorPoints = this.transferFunction.colorPoints;

        if (points[index].hu !== undefined) points[index].hu = hu;
        else points[index].value = hu;

        if (colorPoints[index]) {
            if (colorPoints[index].hu !== undefined) colorPoints[index].hu = hu;
            else colorPoints[index].value = hu;
        }

        this.drawTransferFunctionEditor();
        this.applyTransferFunction();
    }

    /**
     * Update point opacity
     */
    updatePointOpacity(index, value) {
        this.transferFunction.opacityPoints[index].opacity = parseFloat(value);
        this.drawTransferFunctionEditor();
        this.applyTransferFunction();
    }

    /**
     * Update point color
     */
    updatePointColor(index, hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);

        const colorPoints = this.transferFunction.colorPoints;
        if (colorPoints[index]) {
            colorPoints[index].r = r;
            colorPoints[index].g = g;
            colorPoints[index].b = b;
        }

        this.drawTransferFunctionEditor();
        this.applyTransferFunction();
    }

    /**
     * Apply preset from editor dropdown
     */
    applyTFPresetFromEditor(presetId) {
        if (!presetId) return;

        let preset = null;
        if (typeof transferFunctionPresets !== 'undefined') {
            preset = transferFunctionPresets.getPreset(presetId);
        }

        if (preset && preset.colorPoints && preset.opacityPoints) {
            this.transferFunction.colorPoints = JSON.parse(JSON.stringify(preset.colorPoints));
            this.transferFunction.opacityPoints = JSON.parse(JSON.stringify(preset.opacityPoints));

            this.updateControlPointsTable();
            this.drawTransferFunctionEditor();
            this.applyTransferFunction();

            showToast('Preset Applied', preset.name, 'info');
        }
    }

    /**
     * Update custom preset dropdown
     */
    updateCustomPresetSelect() {
        const select = document.getElementById('tf-custom-preset-select');
        if (!select || typeof transferFunctionPresets === 'undefined') return;

        const customPresets = transferFunctionPresets.customPresets;
        let html = '<option value="">Select custom preset...</option>';

        for (const [id, preset] of Object.entries(customPresets)) {
            html += `<option value="${id}">${preset.name}</option>`;
        }

        select.innerHTML = html;
    }

    /**
     * Handle file import
     */
    handleTFImport(input) {
        const file = input.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            const content = e.target.result;
            let result;

            if (file.name.endsWith('.json')) {
                result = transferFunctionPresets.importPresetFromJSON(content);
            } else if (file.name.endsWith('.xml')) {
                result = transferFunctionPresets.importVTKColorTransferFunction(content, file.name.replace('.xml', ''));
            } else if (file.name.endsWith('.ctbl')) {
                result = transferFunctionPresets.importSlicerColorTable(content, file.name.replace('.ctbl', ''));
            }

            if (result && result.success) {
                this.updateCustomPresetSelect();
                showToast('Import Successful', `Imported ${result.imported || 1} preset(s)`, 'success');
            } else {
                showToast('Import Failed', result?.error || 'Unknown error', 'error');
            }
        };
        reader.readAsText(file);
        input.value = '';
    }

    /**
     * Export current transfer function to JSON
     */
    exportCurrentTF() {
        const data = {
            version: '1.0',
            type: 'raster-pacs-transfer-function',
            preset: {
                id: 'export-' + Date.now(),
                name: 'Exported Transfer Function',
                description: 'Exported from Raster PACS',
                modality: 'ALL',
                colorPoints: this.transferFunction.colorPoints,
                opacityPoints: this.transferFunction.opacityPoints
            }
        };

        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'transfer-function.json';
        link.click();
        URL.revokeObjectURL(url);

        showToast('Export Complete', 'Transfer function exported to JSON', 'success');
    }

    /**
     * Save current TF as custom preset
     */
    saveAsCustomPreset() {
        const name = prompt('Enter preset name:', 'My Custom Preset');
        if (!name) return;

        const id = 'custom-' + Date.now();
        if (typeof transferFunctionPresets !== 'undefined') {
            transferFunctionPresets.saveCustomPreset(id, {
                name,
                description: 'Custom preset created in editor',
                modality: 'ALL',
                colorPoints: JSON.parse(JSON.stringify(this.transferFunction.colorPoints)),
                opacityPoints: JSON.parse(JSON.stringify(this.transferFunction.opacityPoints))
            });

            this.updateCustomPresetSelect();
            showToast('Preset Saved', `"${name}" saved to custom presets`, 'success');
        }
    }

    /**
     * Reset transfer function to default
     */
    resetTransferFunction() {
        this.transferFunction = {
            colorMap: 'grayscale',
            opacityPoints: [
                { hu: -1024, opacity: 0 },
                { hu: 0, opacity: 0.1 },
                { hu: 500, opacity: 0.5 },
                { hu: 1000, opacity: 0.8 },
                { hu: 3071, opacity: 1.0 }
            ],
            colorPoints: [
                { hu: -1024, r: 0, g: 0, b: 0 },
                { hu: 0, r: 128, g: 100, b: 80 },
                { hu: 500, r: 220, g: 200, b: 180 },
                { hu: 1000, r: 255, g: 240, b: 220 },
                { hu: 3071, r: 255, g: 255, b: 255 }
            ]
        };

        this.updateControlPointsTable();
        this.drawTransferFunctionEditor();
        this.applyTransferFunction();

        showToast('Reset', 'Transfer function reset to default', 'info');
    }

    /**
     * Hide transfer function editor
     */
    hideTransferFunctionEditor() {
        const modal = document.getElementById('tfEditorModal');
        if (modal) modal.style.display = 'none';
    }

    /**
     * Apply and close transfer function editor
     */
    applyAndCloseTransferFunctionEditor() {
        this.applyTransferFunction();
        this.hideTransferFunctionEditor();
    }

    /**
     * Set color map
     */
    setColorMap(mapName) {
        this.transferFunction.colorMap = mapName;
        this.applyTransferFunction();
    }

    /**
     * Set ISO value for surface rendering
     */
    setIsoValue(value) {
        const isoValue = parseFloat(value);

        // Update label
        const label = document.getElementById('iso-value-label');
        if (label) label.textContent = `${isoValue} HU`;

        // Update WebGL renderer if available
        if (this.webglRenderer) {
            this.webglRenderer.setIsoValue(isoValue);
            this.webglRenderer.render();
            return;
        }

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                isoValue: isoValue
            });
        }


        this.render();
    }

    /**
     * Set surface color
     */
    setSurfaceColor(hexColor) {
        const r = parseInt(hexColor.substr(1, 2), 16);
        const g = parseInt(hexColor.substr(3, 2), 16);
        const b = parseInt(hexColor.substr(5, 2), 16);

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                surfaceColor: [r / 255, g / 255, b / 255]
            });
        }

        this.render();
    }

    /**
     * Set surface opacity
     */
    setSurfaceOpacity(value) {
        const opacity = parseFloat(value);

        const label = document.getElementById('surface-opacity-label');
        if (label) label.textContent = `${Math.round(opacity * 100)}%`;

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                surfaceOpacity: opacity
            });
        }

        this.render();
    }

    /**
     * Toggle shading
     */
    toggleShading(enabled) {
        this.quality.shadingEnabled = enabled;

        const sliders = document.getElementById('shading-sliders');
        if (sliders) sliders.style.display = enabled ? 'block' : 'none';

        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.setShading(enabled);
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.setShading(enabled);
            return;
        }

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                shade: enabled
            });
        }

        this.render();
    }

    /**
     * Set shading parameter
     */
    setShading(param, value) {
        const val = parseFloat(value);
        this.quality[param] = val;

        const label = document.getElementById(`${param}-label`);
        if (label) label.textContent = val.toFixed(2);

        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.setShadingParams(
                this.quality.ambient,
                this.quality.diffuse,
                this.quality.specular
            );
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.setShadingParams(
                this.quality.ambient,
                this.quality.diffuse,
                this.quality.specular
            );
            return;
        }

        if (this.viewport && this.viewport.setProperties) {
            const props = {};
            props[param] = val;
            this.viewport.setProperties(props);
        }

        this.render();
    }

    /**
     * Toggle clipping
     */
    toggleClipping(enabled) {
        this.clippingPlanes.enabled = enabled;

        const sliders = document.getElementById('clipping-sliders');
        if (sliders) sliders.style.display = enabled ? 'block' : 'none';

        this.updateClippingPlanes();
    }

    /**
     * Toggle individual clip plane
     */
    toggleClipPlane(plane, enabled) {
        this.clippingPlanes[plane].enabled = enabled;
        this.updateClippingPlanes();
    }

    /**
     * Set clip plane position
     */
    setClipPosition(plane, value) {
        this.clippingPlanes[plane].position = parseFloat(value);
        this.updateClippingPlanes();
    }

    /**
     * Invert clip plane
     */
    invertClipPlane(plane) {
        this.clippingPlanes[plane].inverted = !this.clippingPlanes[plane].inverted;
        this.updateClippingPlanes();
    }

    /**
     * Update clipping planes
     */
    updateClippingPlanes() {
        if (!this.viewport) return;

        // Build clipping plane configuration
        const planes = [];

        if (this.clippingPlanes.enabled) {
            ['axial', 'sagittal', 'coronal'].forEach(plane => {
                if (this.clippingPlanes[plane].enabled) {
                    planes.push({
                        plane: plane,
                        position: this.clippingPlanes[plane].position,
                        inverted: this.clippingPlanes[plane].inverted
                    });
                }
            });
        }

        // Apply to viewport
        if (this.viewport.setClippingPlanes) {
            this.viewport.setClippingPlanes(planes);
        }

        this.render();
    }

    /**
     * Set sample distance (quality)
     */
    setSampleDistance(value) {
        this.quality.sampleDistance = parseFloat(value);

        const label = document.getElementById('sample-distance-label');
        if (label) label.textContent = `${value}x`;

        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.setSampleDistance(this.quality.sampleDistance);
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.setSampleDistance(this.quality.sampleDistance);
            return;
        }

        // Use WebGL renderer if available (fallback)
        if (this.webglRenderer) {
            this.webglRenderer.sampleDistance = this.quality.sampleDistance;
            this.webglRenderer.render();
            return;
        }

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                sampleDistance: this.quality.sampleDistance
            });
        }

        this.render();
    }

    /**
     * Set interactive quality
     */
    setInteractiveQuality(value) {
        this.quality.interactiveQuality = parseFloat(value);

        const label = document.getElementById('interactive-quality-label');
        if (label) label.textContent = `${Math.round(value * 100)}%`;
    }

    /**
     * Rotate camera
     */
    rotateCamera(dx, dy) {
        // Apply rotation based on mouse movement
        const rotationSpeed = 0.5;
        const azimuthDelta = dx * rotationSpeed;
        const elevationDelta = dy * rotationSpeed;

        // Update rotation state
        if (this.currentRotation) {
            this.currentRotation.x = (this.currentRotation.x || 0) + elevationDelta;
            this.currentRotation.y = (this.currentRotation.y || 0) + azimuthDelta;

            // Clamp X rotation
            this.currentRotation.x = Math.max(-80, Math.min(80, this.currentRotation.x));
        }

        // Use WebGL renderer if available
        if (this.webglRenderer) {
            this.webglRenderer.setRotation(this.currentRotation.x, this.currentRotation.y);
            this.webglRenderer.render();
            return;
        }

        // Render 2D fallback
        if (this.canvas && this.ctx) {
            this.renderFallback3D();
            return;
        }

        // Update camera position (spherical coordinates) for Cornerstone3D
        if (this.viewport && this.viewport.setCamera) {
            const camera = this.viewport.getCamera();

            // Calculate new camera position based on rotation
            // Using spherical coordinate transformation
            const position = camera.position || this.camera.position;
            const focalPoint = camera.focalPoint || this.camera.focalPoint;

            // Vector from focal point to camera
            const dx_cam = position[0] - focalPoint[0];
            const dy_cam = position[1] - focalPoint[1];
            const dz_cam = position[2] - focalPoint[2];

            // Current distance
            const r = Math.sqrt(dx_cam * dx_cam + dy_cam * dy_cam + dz_cam * dz_cam);

            // Current angles
            let theta = Math.atan2(dx_cam, dz_cam); // Azimuth
            let phi = Math.acos(dy_cam / r); // Elevation

            // Apply rotation
            theta += azimuthDelta * Math.PI / 180;
            phi += elevationDelta * Math.PI / 180;

            // Clamp elevation to avoid gimbal lock
            phi = Math.max(0.1, Math.min(Math.PI - 0.1, phi));

            // Calculate new position
            const newPosition = [
                focalPoint[0] + r * Math.sin(phi) * Math.sin(theta),
                focalPoint[1] + r * Math.cos(phi),
                focalPoint[2] + r * Math.sin(phi) * Math.cos(theta)
            ];

            // Update camera
            this.viewport.setCamera({
                ...camera,
                position: newPosition
            });
        }

        this.render();
    }

    /**
     * Pan camera
     */
    panCamera(dx, dy) {
        if (this.viewport && this.viewport.pan) {
            this.viewport.pan({ x: dx, y: dy });
        }
        this.render();
    }

    /**
     * Zoom camera
     */
    zoomCamera(delta) {
        this.camera.zoom = Math.max(0.1, Math.min(10, this.camera.zoom + delta * 0.01));

        const zoomLabel = document.getElementById('overlay-3d-zoom');
        if (zoomLabel) zoomLabel.textContent = `Zoom: ${Math.round(this.camera.zoom * 100)}%`;

        // Use WebGL renderer if available
        if (this.webglRenderer) {
            this.webglRenderer.setZoom(this.camera.zoom);
            this.webglRenderer.render();
            return;
        }

        if (this.viewport && this.viewport.zoom) {
            this.viewport.zoom(delta * 0.01);
        }

        this.render();
    }

    /**
     * Reset camera to default position
     */
    resetCamera() {
        this.camera = {
            position: [0, 0, 500],
            focalPoint: [0, 0, 0],
            viewUp: [0, 1, 0],
            zoom: 1.0
        };

        // Reset rotation state
        if (this.currentRotation) {
            this.currentRotation = { x: 0, y: 0 };
        }

        // Reset SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.resetCamera();
        }
        // Reset VTK renderer if available (secondary)
        else if (this.vtkRenderer) {
            this.vtkRenderer.resetCamera();
        }
        // Reset WebGL renderer if available (fallback)
        else if (this.webglRenderer) {
            this.webglRenderer.setRotation(0, 0);
            this.webglRenderer.setZoom(1.0);
            this.webglRenderer.render();
        }

        if (this.viewport && this.viewport.resetCamera) {
            this.viewport.resetCamera();
        }

        const zoomLabel = document.getElementById('overlay-3d-zoom');
        if (zoomLabel) zoomLabel.textContent = 'Zoom: 100%';

        this.render();
        showToast('Camera Reset', 'View reset to default position', 'info');
    }

    /**
     * Set standard view (anterior, posterior, left, right, superior, inferior)
     */
    setStandardView(view) {
        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.setStandardView(view);
            showToast(`${view.charAt(0).toUpperCase() + view.slice(1)} View`, '', 'info');
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.setStandardView(view);
            showToast(`${view.charAt(0).toUpperCase() + view.slice(1)} View`, '', 'info');
            return;
        }

        const viewSettings = {
            anterior: { position: [0, -500, 0], viewUp: [0, 0, 1] },
            posterior: { position: [0, 500, 0], viewUp: [0, 0, 1] },
            left: { position: [-500, 0, 0], viewUp: [0, 0, 1] },
            right: { position: [500, 0, 0], viewUp: [0, 0, 1] },
            superior: { position: [0, 0, 500], viewUp: [0, 1, 0] },
            inferior: { position: [0, 0, -500], viewUp: [0, 1, 0] }
        };

        const settings = viewSettings[view];
        if (settings && this.viewport && this.viewport.setCamera) {
            this.viewport.setCamera({
                position: settings.position,
                focalPoint: [0, 0, 0],
                viewUp: settings.viewUp
            });
        }

        this.render();
        showToast(`${view.charAt(0).toUpperCase() + view.slice(1)} View`, '', 'info');
    }

    /**
     * Toggle animation
     */
    toggleAnimation() {
        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            const isPlaying = this.simpleRenderer.toggleAnimation();
            this.animation.isPlaying = isPlaying;
            const playBtn = document.getElementById('anim-play-btn');
            if (playBtn) {
                playBtn.textContent = isPlaying ? '⏸️' : '▶️';
            }
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            const isPlaying = this.vtkRenderer.toggleAnimation();
            this.animation.isPlaying = isPlaying;
            const playBtn = document.getElementById('anim-play-btn');
            if (playBtn) {
                playBtn.textContent = isPlaying ? '⏸️' : '▶️';
            }
            return;
        }

        this.animation.isPlaying = !this.animation.isPlaying;

        const playBtn = document.getElementById('anim-play-btn');
        if (playBtn) {
            playBtn.textContent = this.animation.isPlaying ? '⏸️' : '▶️';
        }

        if (this.animation.isPlaying) {
            this.startAnimation();
        } else {
            this.stopAnimation();
        }
    }

    /**
     * Start rotation animation
     */
    startAnimation() {
        const animate = () => {
            if (!this.animation.isPlaying) return;

            const speed = this.animation.rotationSpeed;

            // Rotate camera around the specified axis
            switch (this.animation.rotationAxis) {
                case 'Y':
                    this.rotateCamera(speed * 2, 0);
                    break;
                case 'X':
                    this.rotateCamera(0, speed * 2);
                    break;
                case 'Z':
                    // Z-axis rotation
                    break;
            }

            this.animation.animationId = requestAnimationFrame(animate);
        };

        animate();
    }

    /**
     * Stop animation
     */
    stopAnimation() {
        if (this.animation.animationId) {
            cancelAnimationFrame(this.animation.animationId);
            this.animation.animationId = null;
        }
        this.renderFinalQuality();
    }

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        this.animation.rotationSpeed = parseFloat(speed);
    }

    /**
     * Set rotation axis
     */
    setRotationAxis(axis) {
        this.animation.rotationAxis = axis;
    }

    /**
     * Toggle fullscreen
     */
    toggleFullscreen() {
        const viewport = document.getElementById('viewport-3d-0');
        if (!viewport) return;

        if (document.fullscreenElement) {
            document.exitFullscreen();
        } else {
            viewport.requestFullscreen();
        }
    }

    /**
     * Capture screenshot
     */
    captureScreenshot() {
        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            const dataUrl = this.simpleRenderer.captureScreenshot();
            if (dataUrl) {
                const link = document.createElement('a');
                link.download = `3D_Screenshot_${new Date().toISOString().slice(0, 10)}.png`;
                link.href = dataUrl;
                link.click();
                showToast('Screenshot Captured', 'Image saved to downloads', 'success');
            } else {
                showToast('Error', 'Failed to capture screenshot', 'error');
            }
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            const dataUrl = this.vtkRenderer.captureScreenshot();
            if (dataUrl) {
                const link = document.createElement('a');
                link.download = `3D_Screenshot_${new Date().toISOString().slice(0, 10)}.png`;
                link.href = dataUrl;
                link.click();
                showToast('Screenshot Captured', 'Image saved to downloads', 'success');
            } else {
                showToast('Error', 'Failed to capture screenshot', 'error');
            }
            return;
        }

        if (!this.viewportElement) {
            showToast('Error', 'No viewport to capture', 'error');
            return;
        }

        const canvas = this.viewportElement.querySelector('canvas');
        if (!canvas) {
            showToast('Error', 'No canvas found', 'error');
            return;
        }

        // Create download link
        const link = document.createElement('a');
        link.download = `3D_Screenshot_${new Date().toISOString().slice(0, 10)}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();

        showToast('Screenshot Captured', 'Image saved to downloads', 'success');
    }

    /**
     * Export video (animated rotation)
     */
    async exportVideo() {
        showToast('Recording', 'Recording 360° rotation...', 'info');

        // This would use MediaRecorder API to capture canvas
        // For now, show a placeholder message
        showToast('Export Video', 'Video export feature coming soon', 'info');
    }

    /**
     * Export 3D model (STL/OBJ)
     */
    async export3DModel() {
        showToast('Export 3D', 'Generating 3D model...', 'info');

        // This would extract isosurface and export as STL
        // For now, show a placeholder message
        showToast('Export 3D Model', '3D model export feature coming soon', 'info');
    }

    /**
     * Render viewport
     */
    render() {
        // Use SimpleVolumeRenderer if available (primary)
        if (this.simpleRenderer) {
            this.simpleRenderer.render();
            return;
        }

        // Use VTK renderer if available (secondary)
        if (this.vtkRenderer) {
            this.vtkRenderer.render();
            return;
        }

        // Use WebGL renderer if available (fallback)
        if (this.webglRenderer) {
            this.webglRenderer.render();
            return;
        }

        // Use 2D fallback renderer if canvas context is available
        if (this.canvas && this.ctx) {
            this.renderFallback3D();
            return;
        }

        if (this.viewport && this.viewport.render) {
            this.viewport.render();
        }
    }

    /**
     * Render at final quality (after interaction ends)
     */
    renderFinalQuality() {
        // SimpleVolumeRenderer handles quality internally
        if (this.simpleRenderer) {
            this.simpleRenderer.render();
            return;
        }

        // VTK renderer handles quality internally
        if (this.vtkRenderer) {
            this.vtkRenderer.render();
            return;
        }

        if (this.webglRenderer) {
            // WebGL renderer always uses same quality
            this.webglRenderer.render();
            return;
        }

        if (this.viewport && this.viewport.setProperties) {
            this.viewport.setProperties({
                sampleDistance: this.quality.sampleDistance * this.quality.finalQuality
            });
        }
        this.render();
    }
}

// Create global instance
const reconstruction3D = new Reconstruction3D();

// Export
window.reconstruction3D = reconstruction3D;
window.Reconstruction3D = Reconstruction3D;

