/**
 * Advanced Viewport Manager
 * Manages multiple viewports with MPR and 3D rendering support
 */

class AdvancedViewportManager {
    constructor() {
        this.renderingEngine = null;
        this.viewports = new Map();
        this.activeViewportId = null;
        this.layout = { rows: 1, cols: 1, type: 'stack' };
        this.loadedSeries = new Map();
        this.loadedVolumes = new Map();
        this.toolGroups = new Map();
        this.currentStudy = null;
        this.volumeIdCounter = 0;
    }

    async initialize() {
        console.log('Initializing Advanced Viewport Manager...');

        // Initialize Cornerstone3D
        const success = await CornerstoneService.init();

        if (!success || window.useFallbackRenderer) {
            console.log('Using fallback renderer');
            this.useFallback = true;
        }

        this.renderingEngine = CornerstoneService.getRenderingEngine();

        // Setup initial layout
        this.setupViewports(1, 1, 'stack');

        console.log('Advanced Viewport Manager initialized');
    }

    /**
     * Setup viewports with specified layout
     */
    setupViewports(rows, cols, type = 'stack') {
        const grid = document.getElementById('viewportGrid');
        if (!grid) return;

        // Clear existing
        this.clearViewports();

        // Update grid layout
        grid.className = 'viewport-grid';
        grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
        grid.style.gridTemplateRows = `repeat(${rows}, 1fr)`;

        const count = rows * cols;
        const viewportIds = [];

        // Create viewport elements
        for (let i = 0; i < count; i++) {
            const viewportConfig = this.createViewportElement(i, type);
            grid.appendChild(viewportConfig.element);
            viewportIds.push(viewportConfig.viewportId);

            // Create FallbackViewport instance immediately for tool support
            // This will be replaced when an image is loaded
            if (this.useFallback || window.useFallbackRenderer) {
                const element = document.getElementById(`viewport-element-${i}`);
                if (element) {
                    const viewport = new FallbackViewport({
                        viewportId: viewportConfig.viewportId,
                        element: element
                    });
                    this.viewports.set(viewportConfig.viewportId, viewport);
                    console.log('Created FallbackViewport for:', viewportConfig.viewportId);
                }
            }
        }

        // Create tool group for these viewports (if using Cornerstone3D)
        if (!this.useFallback && !window.useFallbackRenderer) {
            const toolGroupId = `toolGroup-${type}`;
            CornerstoneService.createToolGroup(toolGroupId, viewportIds);
            this.toolGroups.set(type, toolGroupId);
        }

        this.layout = { rows, cols, type };
        this.setActiveViewport('viewport-0');
    }

    /**
     * Create a viewport element
     */
    createViewportElement(index, type) {
        const viewportId = `viewport-${index}`;

        const viewportDiv = document.createElement('div');
        viewportDiv.className = 'viewport';
        viewportDiv.id = viewportId;
        viewportDiv.innerHTML = `
            <div class="viewport-overlay top-left">
                <span id="overlay-patient-${index}"></span>
                <span id="overlay-study-${index}"></span>
            </div>
            <div class="viewport-overlay top-right">
                <span id="overlay-orientation-${index}"></span>
                <span id="overlay-modality-${index}"></span>
            </div>
            <div class="viewport-overlay bottom-left">
                <span id="overlay-wl-${index}"></span>
                <span id="overlay-zoom-${index}"></span>
            </div>
            <div class="viewport-overlay bottom-right">
                <span id="overlay-slice-${index}"></span>
            </div>
            <div class="viewport-element" id="viewport-element-${index}"></div>
            <div class="viewport-empty" id="viewport-empty-${index}">
                <div class="empty-content">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
                    </svg>
                    <p>Drop series here</p>
                </div>
            </div>
        `;

        // Setup event handlers
        this.setupViewportEvents(viewportDiv, viewportId, type, index);

        return { element: viewportDiv, viewportId };
    }

    /**
     * Setup viewport event handlers
     */
    setupViewportEvents(viewportDiv, viewportId, type, index) {
        // Click to select
        viewportDiv.addEventListener('click', () => this.setActiveViewport(viewportId));

        // Drag and drop
        viewportDiv.addEventListener('dragover', (e) => {
            e.preventDefault();
            viewportDiv.classList.add('dragover');
        });

        viewportDiv.addEventListener('dragleave', () => {
            viewportDiv.classList.remove('dragover');
        });

        viewportDiv.addEventListener('drop', async (e) => {
            e.preventDefault();
            viewportDiv.classList.remove('dragover');

            try {
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                await this.loadSeries(data.studyUid, data.seriesUid, viewportId);
            } catch (err) {
                console.error('Drop error:', err);
            }
        });

        // Direct mouse control for tools (works for both fallback and Cornerstone3D)
        const viewportElement = viewportDiv.querySelector('.viewport-element') || viewportDiv;
        let isDragging = false;
        let lastMousePos = { x: 0, y: 0 };

        viewportElement.addEventListener('mousedown', (e) => {
            // Only handle left mouse button
            if (e.button !== 0) return;
            isDragging = true;
            lastMousePos = { x: e.clientX, y: e.clientY };
            this.setActiveViewport(viewportId);
            e.preventDefault();
        });

        viewportElement.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const deltaX = e.clientX - lastMousePos.x;
            const deltaY = e.clientY - lastMousePos.y;
            const tool = (window.activeTool || 'WindowLevel').toLowerCase();

            // Get the viewport instance
            const viewport = this.viewports.get(viewportId);
            if (!viewport) {
                lastMousePos = { x: e.clientX, y: e.clientY };
                return;
            }

            // Handle tool actions
            switch (tool) {
                case 'windowlevel':
                    // Adjust window/level (contrast/brightness)
                    if (viewport.state) {
                        const newWidth = (viewport.state.windowWidth || 400) + deltaX * 2;
                        const newCenter = (viewport.state.windowCenter || 40) + deltaY * 2;
                        viewport.state.windowWidth = Math.max(1, newWidth);
                        viewport.state.windowCenter = newCenter;
                        // Reload image with new W/L
                        if (viewport.loadAndDisplayImage) {
                            viewport.loadAndDisplayImage(viewport.currentImageIndex);
                        }
                        // Update overlay
                        const idx = viewportId.split('-')[1];
                        const wlEl = document.getElementById(`overlay-wl-${idx}`);
                        if (wlEl) {
                            wlEl.textContent = `W: ${Math.round(viewport.state.windowWidth)} L: ${Math.round(viewport.state.windowCenter)}`;
                        }
                    }
                    break;

                case 'pan':
                    // Pan the image
                    if (viewport.state) {
                        viewport.state.panX = (viewport.state.panX || 0) + deltaX;
                        viewport.state.panY = (viewport.state.panY || 0) + deltaY;
                        if (viewport.render) viewport.render();
                        // Update overlay
                        const idx = viewportId.split('-')[1];
                        const zoomEl = document.getElementById(`overlay-zoom-${idx}`);
                        if (zoomEl) {
                            zoomEl.textContent = `Pan: ${Math.round(viewport.state.panX)}, ${Math.round(viewport.state.panY)}`;
                        }
                    }
                    break;

                case 'zoom':
                    // Zoom with vertical drag
                    if (viewport.state) {
                        const zoomDelta = deltaY * -0.01;
                        viewport.state.zoom = Math.max(0.1, Math.min(10, (viewport.state.zoom || 1) + zoomDelta));
                        if (viewport.render) viewport.render();
                        // Update overlay
                        const idx = viewportId.split('-')[1];
                        const zoomEl = document.getElementById(`overlay-zoom-${idx}`);
                        if (zoomEl) {
                            zoomEl.textContent = `Zoom: ${(viewport.state.zoom * 100).toFixed(0)}%`;
                        }
                    }
                    break;

                case 'stackscroll':
                case 'scroll':
                    // Scroll through stack
                    if (Math.abs(deltaY) > 3) {
                        if (deltaY > 0 && viewport.nextImage) {
                            viewport.nextImage();
                        } else if (deltaY < 0 && viewport.previousImage) {
                            viewport.previousImage();
                        }
                        lastMousePos = { x: e.clientX, y: e.clientY };
                        return;
                    }
                    break;

                case 'length':
                case 'angle':
                case 'ellipticalroi':
                case 'roi':
                    // Measurement tools - handled by Cornerstone or we show a message
                    console.log('Measurement tool:', tool, '- click and drag to measure');
                    break;
            }

            lastMousePos = { x: e.clientX, y: e.clientY };
        });

        viewportElement.addEventListener('mouseup', () => {
            isDragging = false;
        });

        viewportElement.addEventListener('mouseleave', () => {
            isDragging = false;
        });

        // Mouse wheel for scrolling
        viewportElement.addEventListener('wheel', (e) => {
            e.preventDefault();
            const viewport = this.viewports.get(viewportId);
            if (viewport) {
                if (e.deltaY > 0 && viewport.nextImage) {
                    viewport.nextImage();
                } else if (e.deltaY < 0 && viewport.previousImage) {
                    viewport.previousImage();
                }
            }
        });
    }

    /**
     * Clear all viewports
     */
    clearViewports() {
        // Disable viewports in rendering engine
        this.viewports.forEach((vp, id) => {
            if (this.renderingEngine && this.renderingEngine.getViewport(id)) {
                this.renderingEngine.disableElement(id);
            }
        });

        this.viewports.clear();

        // Clear grid
        const grid = document.getElementById('viewportGrid');
        if (grid) {
            grid.innerHTML = '';
        }
    }

    /**
     * Set active viewport
     */
    setActiveViewport(viewportId) {
        document.querySelectorAll('.viewport').forEach(el => el.classList.remove('active'));

        const viewportEl = document.getElementById(viewportId);
        if (viewportEl) {
            viewportEl.classList.add('active');
        }

        this.activeViewportId = viewportId;
    }

    /**
     * Get active viewport
     */
    getActiveViewport() {
        if (this.useFallback) {
            return this.viewports.get(this.activeViewportId);
        }

        if (this.renderingEngine) {
            return this.renderingEngine.getViewport(this.activeViewportId);
        }
        return null;
    }

    /**
     * Load a series into a viewport
     */
    async loadSeries(studyUid, seriesUid, viewportId = null) {
        const targetViewportId = viewportId || this.activeViewportId;
        const index = targetViewportId.split('-')[1];

        console.log(`[ViewportManager] Loading series ${seriesUid} into ${targetViewportId}`);
        console.log(`[ViewportManager] Study UID: ${studyUid}`);

        // Show loading state
        this.showLoading(index, 'Loading series...');

        try {
            // Get selected PACS node
            const pacsNode = document.getElementById('pacsNode')?.value || '';
            const params = pacsNode ? { pacsNode } : {};
            console.log(`[ViewportManager] PACS Node: ${pacsNode || 'default'}`);

            // Get instances for the series
            console.log(`[ViewportManager] Fetching instances...`);
            const response = await api.searchInstances(studyUid, seriesUid, params);
            console.log(`[ViewportManager] Response:`, response);
            const instances = Array.isArray(response) ? response : [];
            console.log(`[ViewportManager] Found ${instances.length} instances`);

            if (!instances || instances.length === 0) {
                console.warn(`[ViewportManager] No instances found for series ${seriesUid}`);
                showToast('Warning', 'No images found in series', 'warning');
                this.showEmpty(index);
                return;
            }

            // Sort by instance number
            instances.sort((a, b) => (a.instanceNumber || 0) - (b.instanceNumber || 0));

            // Build image IDs
            const imageIds = instances.map(inst =>
                `wadouri:${api.getWadoUri(studyUid, seriesUid, inst.sopInstanceUid)}`
            );

            // Load based on layout type
            if (this.layout.type === 'mpr' || this.layout.type === '3d') {
                await this.loadVolume(studyUid, seriesUid, imageIds);
            } else {
                await this.loadStack(targetViewportId, imageIds, index);
            }

            // Hide empty state
            this.hideEmpty(index);

            // Store mapping
            this.loadedSeries.set(seriesUid, { viewportId: targetViewportId, instances });

            // Update overlays
            this.updateViewportOverlays(targetViewportId, instances[0]);

            // Show cine controls for multi-frame
            if (instances.length > 1) {
                const cineControls = document.getElementById('cineControls') || document.getElementById('cineSection');
                if (cineControls) {
                    cineControls.style.display = 'flex';
                }
            }

            // Load thumbnails
            this.loadThumbnails(studyUid, seriesUid, instances);

            showToast('Success', `Loaded ${instances.length} images`, 'success');

        } catch (error) {
            console.error('Error loading series:', error);
            showToast('Error', `Failed to load series: ${error.message}`, 'error');
            this.showEmpty(index);
        }
    }

    /**
     * Load images as a stack
     */
    async loadStack(viewportId, imageIds, index) {
        if (this.useFallback) {
            // Check if we already have a FallbackViewport for this ID
            let viewport = this.viewports.get(viewportId);

            if (viewport && viewport instanceof FallbackViewport) {
                // Reuse existing viewport, just load new stack
                await viewport.setStack(imageIds, 0);
            } else {
                // Create new FallbackViewport
                viewport = new FallbackViewport({
                    viewportId,
                    element: document.getElementById(`viewport-element-${index}`)
                });

                // Preserve the current active tool from global state
                if (window.activeTool) {
                    const toolMap = {
                        'WindowLevel': 'windowlevel',
                        'Pan': 'pan',
                        'Zoom': 'zoom',
                        'StackScroll': 'scroll'
                    };
                    viewport.activeTool = toolMap[window.activeTool] || window.activeTool.toLowerCase();
                    console.log('New viewport inherits tool:', viewport.activeTool);
                }

                this.viewports.set(viewportId, viewport);
                await viewport.setStack(imageIds, 0);
            }
            return;
        }

        // Cornerstone3D rendering
        const element = document.getElementById(`viewport-element-${index}`);
        const viewport = await CornerstoneService.createStackViewport(viewportId, element);

        if (viewport) {
            await viewport.setStack(imageIds, 0);
            viewport.render();
            this.viewports.set(viewportId, viewport);
        }
    }

    /**
     * Load images as a volume for MPR/3D
     */
    async loadVolume(studyUid, seriesUid, imageIds) {
        const volumeId = `volume-${studyUid}-${seriesUid}`;

        // Check if volume already loaded
        if (this.loadedVolumes.has(volumeId)) {
            console.log('Volume already loaded:', volumeId);
            return this.loadedVolumes.get(volumeId);
        }

        showToast('Loading', 'Loading volume data...', 'info');

        try {
            // Create and load volume
            const volume = await CornerstoneService.loadVolume(volumeId, imageIds);
            this.loadedVolumes.set(volumeId, volume);

            // Get viewport IDs
            const viewportIds = Array.from(this.viewports.keys());

            // Setup viewports based on layout type
            if (this.layout.type === 'mpr') {
                await this.setupMPRViewports(volumeId, imageIds);
            } else if (this.layout.type === '3d') {
                await this.setup3DViewports(volumeId);
            }

            showToast('Success', 'Volume loaded successfully', 'success');
            return volume;

        } catch (error) {
            console.error('Error loading volume:', error);
            showToast('Error', 'Failed to load volume', 'error');
            throw error;
        }
    }

    /**
     * Setup MPR viewports (Axial, Sagittal, Coronal)
     */
    async setupMPRViewports(volumeId, imageIds) {
        const orientations = ['AXIAL', 'SAGITTAL', 'CORONAL'];
        const viewportIds = [];

        for (let i = 0; i < 3 && i < this.layout.rows * this.layout.cols; i++) {
            const viewportId = `viewport-${i}`;
            const element = document.getElementById(`viewport-element-${i}`);

            if (element) {
                const viewport = await CornerstoneService.createVolumeViewport(
                    viewportId,
                    element,
                    orientations[i]
                );

                if (viewport) {
                    this.viewports.set(viewportId, viewport);
                    viewportIds.push(viewportId);

                    // Update orientation label
                    const labelEl = document.getElementById(`overlay-orientation-${i}`);
                    if (labelEl) {
                        labelEl.textContent = orientations[i];
                    }
                }
            }
        }

        // Create MPR tool group with crosshairs
        CornerstoneService.createMPRToolGroup('mpr-tools', viewportIds);

        // Set volume on all viewports
        await CornerstoneService.setVolumeOnViewports(volumeId, viewportIds);
    }

    /**
     * Setup 3D viewport
     */
    async setup3DViewports(volumeId) {
        // Create 3D viewport in the last quadrant or main viewport
        const viewportIndex = this.layout.rows * this.layout.cols - 1;
        const viewportId = `viewport-${viewportIndex}`;
        const element = document.getElementById(`viewport-element-${viewportIndex}`);

        if (element) {
            const viewport = await CornerstoneService.create3DViewport(viewportId, element);

            if (viewport) {
                this.viewports.set(viewportId, viewport);

                // Create 3D tool group
                CornerstoneService.create3DToolGroup('3d-tools', [viewportId]);

                // Set volume
                await CornerstoneService.setVolumeOnViewports(volumeId, [viewportId]);

                // Update label
                const labelEl = document.getElementById(`overlay-orientation-${viewportIndex}`);
                if (labelEl) {
                    labelEl.textContent = '3D';
                }
            }
        }
    }

    /**
     * Set layout
     */
    setLayout(rows, cols, type = 'stack') {
        this.setupViewports(rows, cols, type);

        // Update layout buttons
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.layout === `${rows}x${cols}`);
        });
    }

    /**
     * Set MPR layout (2x2 with Axial, Sagittal, Coronal + 3D)
     */
    async setMPRLayout() {
        console.log('Setting up MPR layout');

        // Use the new MPR viewer if available
        if (typeof mprViewer !== 'undefined') {
            // Get current series data if loaded
            const seriesData = Array.from(this.loadedSeries.values())[0];
            if (seriesData) {
                const imageIds = seriesData.instances.map(inst =>
                    `wadouri:${api.getWadoUri(window.appState?.currentStudy?.studyInstanceUid, seriesData.seriesUid, inst.sopInstanceUid)}`
                );
                await mprViewer.setupMPRLayout(
                    window.appState?.currentStudy?.studyInstanceUid,
                    seriesData.seriesUid,
                    imageIds
                );
                showToast('MPR layout ready', 'success');
                return;
            } else {
                // Just setup the layout, wait for series to be loaded
                await mprViewer.setupMPRLayout(null, null, []);
                showToast('MPR layout ready - Load a CT/MR series', 'info');
                return;
            }
        }

        if (this.useFallback) {
            showToast('Warning', 'MPR requires WebGL support', 'warning');
            return;
        }

        // Clear current viewports
        this.clearViewports();

        const grid = document.getElementById('viewportGrid');
        grid.className = 'viewport-grid layout-mpr';
        grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
        grid.style.gridTemplateRows = 'repeat(2, 1fr)';

        const orientations = ['AXIAL', 'SAGITTAL', 'CORONAL', '3D'];
        const viewportIds = [];

        for (let i = 0; i < 4; i++) {
            const viewportConfig = this.createViewportElement(i, 'mpr');
            grid.appendChild(viewportConfig.element);
            viewportIds.push(viewportConfig.viewportId);

            // Set orientation label
            const labelEl = document.getElementById(`overlay-orientation-${i}`);
            if (labelEl) {
                labelEl.textContent = orientations[i];
            }
        }

        this.layout = { rows: 2, cols: 2, type: 'mpr' };
        this.setActiveViewport('viewport-0');

        // Update layout buttons
        document.querySelectorAll('.layout-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.layout === 'mpr');
        });

        showToast('Info', 'MPR layout ready - Load a CT/MR series', 'info');
    }

    /**
     * Update viewport overlays
     */
    updateViewportOverlays(viewportId, instance) {
        const idx = viewportId.split('-')[1];

        // Patient info from current study
        if (window.appState?.currentStudy) {
            const study = window.appState.currentStudy;

            const patientEl = document.getElementById(`overlay-patient-${idx}`);
            if (patientEl) patientEl.textContent = study.patientName || 'Unknown';

            const studyEl = document.getElementById(`overlay-study-${idx}`);
            if (studyEl) studyEl.textContent = formatDicomDate(study.studyDate);
        }

        // Modality
        const modalityEl = document.getElementById(`overlay-modality-${idx}`);
        if (modalityEl && instance) {
            modalityEl.textContent = instance.modality || '';
        }
    }

    /**
     * Load thumbnails for current series
     */
    async loadThumbnails(studyUid, seriesUid, instances) {
        const grid = document.getElementById('thumbnailGrid');
        if (!grid) return;

        grid.innerHTML = '';

        for (let i = 0; i < instances.length; i++) {
            const inst = instances[i];
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'thumbnail-item';
            thumbDiv.dataset.index = i;
            thumbDiv.dataset.instanceUid = inst.sopInstanceUid;

            thumbDiv.innerHTML = `
                <img src="" alt="Image ${i + 1}">
                <span class="label">${i + 1}</span>
            `;

            // Load thumbnail image with retry logic
            this.loadThumbnailWithRetry(thumbDiv, studyUid, seriesUid, inst.sopInstanceUid, i);

            // Click to jump to image
            thumbDiv.addEventListener('click', () => {
                this.jumpToImage(i);
                grid.querySelectorAll('.thumbnail-item').forEach(t => t.classList.remove('active'));
                thumbDiv.classList.add('active');
            });

            grid.appendChild(thumbDiv);
        }

        // Mark first as active
        if (grid.firstChild) {
            grid.firstChild.classList.add('active');
        }
    }

    /**
     * Load thumbnail with retry for 202 Accepted responses
     */
    async loadThumbnailWithRetry(thumbDiv, studyUid, seriesUid, sopInstanceUid, index, retryCount = 0) {
        const MAX_RETRIES = 3;
        const RETRY_DELAY = 2000;

        try {
            const response = await api.getThumbnail(studyUid, seriesUid, sopInstanceUid, 64);

            // Handle 202 Accepted - file is being retrieved from PACS
            if (response.status === 202) {
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => {
                        this.loadThumbnailWithRetry(thumbDiv, studyUid, seriesUid, sopInstanceUid, index, retryCount + 1);
                    }, RETRY_DELAY);
                }
                return;
            }

            if (response.ok) {
                const blob = await response.blob();
                const img = thumbDiv.querySelector('img');
                if (img) {
                    img.src = URL.createObjectURL(blob);
                }
            }
        } catch (e) {
            // Keep placeholder
        }
    }

    /**
     * Jump to specific image index
     */
    jumpToImage(index) {
        const viewport = this.getActiveViewport();

        if (viewport) {
            if (typeof viewport.setImageIdIndex === 'function') {
                viewport.setImageIdIndex(index);
            } else if (typeof viewport.loadAndDisplayImage === 'function') {
                viewport.loadAndDisplayImage(index);
            }
        }

        // Update slice overlay
        this.updateSliceOverlay(index);
    }

    /**
     * Update slice number overlay
     */
    updateSliceOverlay(index) {
        const idx = this.activeViewportId?.split('-')[1] || 0;
        const sliceEl = document.getElementById(`overlay-slice-${idx}`);

        const seriesData = Array.from(this.loadedSeries.values())[0];
        if (sliceEl && seriesData) {
            sliceEl.textContent = `${index + 1}/${seriesData.instances.length}`;
        }
    }

    // Viewport manipulation methods
    resetViewport(viewportId = null) {
        const vp = viewportId ? this.viewports.get(viewportId) : this.getActiveViewport();
        if (vp && vp.resetCamera) {
            vp.resetCamera();
            vp.render();
        }
    }

    setWindowLevel(center, width) {
        const vp = this.getActiveViewport();
        if (vp) {
            if (typeof vp.setProperties === 'function') {
                vp.setProperties({
                    voiRange: { lower: center - width / 2, upper: center + width / 2 }
                });
                vp.render();
            }
        }
    }

    flipHorizontal() {
        const vp = this.getActiveViewport();
        if (vp && typeof vp.setCamera === 'function') {
            const camera = vp.getCamera();
            camera.flipHorizontal = !camera.flipHorizontal;
            vp.setCamera(camera);
            vp.render();
        }
    }

    flipVertical() {
        const vp = this.getActiveViewport();
        if (vp && typeof vp.setCamera === 'function') {
            const camera = vp.getCamera();
            camera.flipVertical = !camera.flipVertical;
            vp.setCamera(camera);
            vp.render();
        }
    }

    rotate(angle) {
        const vp = this.getActiveViewport();
        if (vp) {
            if (typeof vp.setProperties === 'function') {
                const currentRotation = vp.getProperties()?.rotation || 0;
                vp.setProperties({ rotation: (currentRotation + angle) % 360 });
                vp.render();
            }
        }
    }

    invert() {
        const vp = this.getActiveViewport();
        if (vp && typeof vp.setProperties === 'function') {
            const currentInvert = vp.getProperties()?.invert || false;
            vp.setProperties({ invert: !currentInvert });
            vp.render();
        }
    }

    // Helper methods
    showLoading(index, message = 'Loading...') {
        const emptyEl = document.getElementById(`viewport-empty-${index}`);
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            emptyEl.innerHTML = `
                <div class="empty-content">
                    <div class="spinner"></div>
                    <p>${message}</p>
                </div>
            `;
        }
    }

    showEmpty(index) {
        const emptyEl = document.getElementById(`viewport-empty-${index}`);
        if (emptyEl) {
            emptyEl.style.display = 'flex';
            emptyEl.innerHTML = `
                <div class="empty-content">
                    <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                        <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
                    </svg>
                    <p>Drop series here</p>
                </div>
            `;
        }
    }

    hideEmpty(index) {
        const emptyEl = document.getElementById(`viewport-empty-${index}`);
        if (emptyEl) {
            emptyEl.style.display = 'none';
        }
    }
}

// Helper function
function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr || '';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// Create global instance
const viewportManager = new AdvancedViewportManager();

