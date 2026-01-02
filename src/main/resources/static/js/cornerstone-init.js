/**
 * Cornerstone3D Initialization
 * Handles loading and configuring the DICOM rendering library
 */

let cornerstoneInitialized = false;
let renderingEngine = null;

/**
 * Initialize Cornerstone3D libraries
 * Note: This uses a simplified approach without ES modules for basic functionality
 * For full Cornerstone3D features, use the npm build with Vite
 */
async function initCornerstone() {
    if (cornerstoneInitialized) {
        return true;
    }

    console.log('Initializing Cornerstone3D...');

    // Check if we're using the bundled version
    if (typeof cornerstone !== 'undefined') {
        try {
            // Initialize cornerstone core
            await cornerstone.init();

            // Initialize tools if available
            if (typeof cornerstoneTools !== 'undefined') {
                await cornerstoneTools.init();
            }

            // Configure image loaders
            if (typeof cornerstoneDICOMImageLoader !== 'undefined') {
                cornerstoneDICOMImageLoader.external.cornerstone = cornerstone;
                cornerstoneDICOMImageLoader.external.dicomParser = dicomParser;

                // Configure web worker
                const config = {
                    maxWebWorkers: navigator.hardwareConcurrency || 1,
                    startWebWorkersOnDemand: true,
                    taskConfiguration: {
                        decodeTask: {
                            initializeCodecsOnStartup: true
                        }
                    }
                };
                cornerstoneDICOMImageLoader.webWorkerManager.initialize(config);
            }

            cornerstoneInitialized = true;
            console.log('Cornerstone3D initialized successfully');
            return true;
        } catch (error) {
            console.error('Failed to initialize Cornerstone3D:', error);
            return false;
        }
    }

    // Fallback: Use simple canvas-based rendering
    console.log('Cornerstone3D not loaded. Using fallback rendering.');
    return initFallbackRenderer();
}

/**
 * Fallback renderer for when Cornerstone3D is not available
 * Uses simple canvas rendering with server-side image conversion
 */
function initFallbackRenderer() {
    window.useFallbackRenderer = true;
    cornerstoneInitialized = true;
    return true;
}

/**
 * Create a rendering engine
 */
function createRenderingEngine(id = 'rasterPacsRenderingEngine') {
    if (!cornerstoneInitialized) {
        console.error('Cornerstone not initialized');
        return null;
    }

    if (window.useFallbackRenderer) {
        return new FallbackRenderingEngine(id);
    }

    if (typeof cornerstone !== 'undefined' && cornerstone.RenderingEngine) {
        renderingEngine = new cornerstone.RenderingEngine(id);
        return renderingEngine;
    }

    return new FallbackRenderingEngine(id);
}

/**
 * Fallback Rendering Engine
 * Simple canvas-based rendering using server-rendered images
 */
class FallbackRenderingEngine {
    constructor(id) {
        this.id = id;
        this.viewports = new Map();
        this.activeViewportId = null;
    }

    setViewports(viewportInputArray) {
        for (const input of viewportInputArray) {
            const viewport = new FallbackViewport(input);
            this.viewports.set(input.viewportId, viewport);
        }
    }

    getViewport(viewportId) {
        return this.viewports.get(viewportId);
    }

    resize() {
        this.viewports.forEach(vp => vp.resize());
    }

    destroy() {
        this.viewports.forEach(vp => vp.destroy());
        this.viewports.clear();
    }
}

/**
 * Fallback Viewport
 * Canvas-based viewport for displaying server-rendered DICOM images
 */
class FallbackViewport {
    constructor(config) {
        this.viewportId = config.viewportId;
        this.element = config.element;
        this.type = config.type || 'stack';

        this.canvas = document.createElement('canvas');
        this.ctx = this.canvas.getContext('2d');
        this.element.appendChild(this.canvas);

        this.imageStack = [];
        this.currentImageIndex = 0;
        this.currentImage = null;

        // Viewport state
        this.state = {
            windowCenter: null,
            windowWidth: null,
            zoom: 1,
            panX: 0,
            panY: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            invert: false
        };

        // Active tool
        this.activeTool = 'windowlevel';
        this.isDragging = false;
        this.lastMousePos = { x: 0, y: 0 };

        // Setup event handlers
        this.setupEventHandlers();
        this.resize();
    }

    setupEventHandlers() {
        // Handle resize
        window.addEventListener('resize', () => this.resize());

        // Mouse wheel for scroll
        this.element.addEventListener('wheel', (e) => {
            e.preventDefault();
            if (e.deltaY > 0) {
                this.nextImage();
            } else {
                this.previousImage();
            }
        });

        // Mouse down
        this.element.addEventListener('mousedown', (e) => {
            // Skip if a measurement tool is active
            if (this.isMeasurementToolActive()) return;

            this.isDragging = true;
            this.lastMousePos = { x: e.clientX, y: e.clientY };
            e.preventDefault();
        });

        // Mouse move
        this.element.addEventListener('mousemove', (e) => {
            if (!this.isDragging) return;
            // Skip if a measurement tool is active
            if (this.isMeasurementToolActive()) {
                this.isDragging = false;
                return;
            }

            const deltaX = e.clientX - this.lastMousePos.x;
            const deltaY = e.clientY - this.lastMousePos.y;

            switch (this.activeTool) {
                case 'windowlevel':
                    // Adjust window level - use client-side rendering during drag
                    const newWidth = (this.state.windowWidth || 400) + deltaX * 2;
                    const newCenter = (this.state.windowCenter || 40) + deltaY * 2;
                    this.state.windowWidth = Math.max(1, newWidth);
                    this.state.windowCenter = newCenter;
                    // Use client-side W/L adjustment (no server call during drag)
                    this.renderWithWindowLevel();
                    break;

                case 'pan':
                    // Pan the image
                    this.state.panX += deltaX;
                    this.state.panY += deltaY;
                    this.render();
                    break;

                case 'zoom':
                    // Zoom with vertical drag
                    const zoomDelta = deltaY * -0.01;
                    this.state.zoom = Math.max(0.1, Math.min(10, this.state.zoom + zoomDelta));
                    this.render();
                    break;

                case 'scroll':
                case 'stackscroll':
                    // Scroll through stack
                    if (Math.abs(deltaY) > 5) {
                        if (deltaY > 0) {
                            this.nextImage();
                        } else {
                            this.previousImage();
                        }
                        this.lastMousePos = { x: e.clientX, y: e.clientY };
                        return;
                    }
                    break;
            }

            this.lastMousePos = { x: e.clientX, y: e.clientY };
            this.updateOverlays();
        });

        // Mouse up - finalize W/L by requesting server-rendered image
        this.element.addEventListener('mouseup', () => {
            if (this.isDragging && this.activeTool === 'windowlevel') {
                // Debounce server request for final W/L
                this.scheduleServerWLUpdate();
            }
            this.isDragging = false;
        });

        this.element.addEventListener('mouseleave', () => {
            this.isDragging = false;
        });

        // Touch support
        this.element.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                this.isDragging = true;
                this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });

        this.element.addEventListener('touchmove', (e) => {
            if (!this.isDragging || e.touches.length !== 1) return;

            const deltaY = e.touches[0].clientY - this.lastMousePos.y;
            if (Math.abs(deltaY) > 10) {
                if (deltaY > 0) {
                    this.nextImage();
                } else {
                    this.previousImage();
                }
                this.lastMousePos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
            }
        });

        this.element.addEventListener('touchend', () => {
            this.isDragging = false;
        });
    }

    /**
     * Set the active tool for this viewport
     */
    setActiveTool(toolName) {
        // Normalize tool name to lowercase
        const normalizedTool = toolName.toLowerCase().trim();

        // Map various tool name formats to our internal names
        const toolMap = {
            'windowlevel': 'windowlevel',
            'wl': 'windowlevel',
            'window': 'windowlevel',
            'pan': 'pan',
            'zoom': 'zoom',
            'scroll': 'scroll',
            'stackscroll': 'scroll',
            'stackscrollmousewheel': 'scroll',
            'length': 'length',
            'angle': 'angle',
            'roi': 'roi',
            'ellipticalroi': 'roi'
        };

        this.activeTool = toolMap[normalizedTool] || normalizedTool;
        console.log('FallbackViewport active tool set to:', this.activeTool);
    }

    /**
     * Check if a measurement tool is currently active
     */
    isMeasurementToolActive() {
        return window.measurementManager && window.measurementManager.activeTool;
    }

    resize() {
        const rect = this.element.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    async setStack(imageIds, initialIndex = 0) {
        this.imageStack = imageIds;
        this.currentImageIndex = initialIndex;

        // Initialize image cache if not exists
        if (!this.imageCache) {
            this.imageCache = new Map();
        }

        // Clear old cache if stack changed significantly
        if (this.imageCache.size > 100) {
            this.imageCache.clear();
        }

        await this.loadAndDisplayImage(initialIndex);

        // Preload adjacent images in background
        this.preloadAdjacentImages(initialIndex);
    }

    /**
     * Preload images adjacent to current index for smooth scrolling
     */
    preloadAdjacentImages(centerIndex) {
        const preloadRange = 5; // Preload 5 images before and after

        for (let offset = 1; offset <= preloadRange; offset++) {
            // Preload forward
            const forwardIdx = centerIndex + offset;
            if (forwardIdx < this.imageStack.length && !this.imageCache.has(forwardIdx)) {
                this.preloadImage(forwardIdx);
            }

            // Preload backward
            const backwardIdx = centerIndex - offset;
            if (backwardIdx >= 0 && !this.imageCache.has(backwardIdx)) {
                this.preloadImage(backwardIdx);
            }
        }
    }

    /**
     * Preload a single image into cache (without displaying)
     */
    async preloadImage(index) {
        if (index < 0 || index >= this.imageStack.length) return;
        if (this.imageCache && this.imageCache.has(index)) return;

        const imageId = this.imageStack[index];

        try {
            const match = imageId.match(/wadouri:(.+)/);
            if (!match) return;

            const url = new URL(match[1], window.location.origin);
            const studyUid = url.searchParams.get('studyUID');
            const seriesUid = url.searchParams.get('seriesUID');
            const instanceUid = url.searchParams.get('objectUID');

            // Fetch without W/L params for base image
            const response = await api.getRenderedInstance(studyUid, seriesUid, instanceUid, {});

            if (response.ok) {
                const blob = await response.blob();
                const imgUrl = URL.createObjectURL(blob);

                const img = new Image();
                img.onload = () => {
                    if (!this.imageCache) this.imageCache = new Map();
                    this.imageCache.set(index, img);
                    // Don't revoke URL - keep for cache
                };
                img.src = imgUrl;
            }
        } catch (e) {
            // Silent fail for preload
        }
    }

    async loadAndDisplayImage(index) {
        if (index < 0 || index >= this.imageStack.length) return;

        // Set loading flag
        this.isLoadingImage = true;
        this.currentImageIndex = index;
        const imageId = this.imageStack[index];

        // Hide empty state
        const emptyEl = document.getElementById(`viewport-empty-${this.viewportId.split('-')[1]}`);
        if (emptyEl) emptyEl.style.display = 'none';

        // Check cache first (for quick scrolling)
        if (this.imageCache && this.imageCache.has(index) &&
            this.state.windowCenter === null && this.state.windowWidth === null) {
            // Use cached image if no custom W/L
            this.currentImage = this.imageCache.get(index);
            this.isLoadingImage = false;
            this.render();
            this.updateOverlays();

            // Check if there's a pending image request from fast scrolling
            if (this.pendingImageIndex !== undefined && this.pendingImageIndex !== index) {
                const pendingIdx = this.pendingImageIndex;
                this.pendingImageIndex = undefined;
                setTimeout(() => this.loadAndDisplayImage(pendingIdx), 10);
                return;
            }

            // Preload adjacent in background
            setTimeout(() => this.preloadAdjacentImages(index), 50);
            return;
        }

        try {
            // Parse the imageId to get UIDs
            const match = imageId.match(/wadouri:(.+)/);
            if (!match) {
                throw new Error('Invalid imageId format');
            }

            const url = new URL(match[1], window.location.origin);
            const studyUid = url.searchParams.get('studyUID');
            const seriesUid = url.searchParams.get('seriesUID');
            const instanceUid = url.searchParams.get('objectUID');

            // Get rendered image from server
            const params = {};
            if (this.state.windowCenter !== null) params.level = Math.round(this.state.windowCenter);
            if (this.state.windowWidth !== null) params.window = Math.round(this.state.windowWidth);

            const response = await api.getRenderedInstance(studyUid, seriesUid, instanceUid, params);

            if (response.status === 202) {
                // Image being retrieved from PACS - show current image while waiting
                if (!this.currentImage) {
                    this.showMessage('Retrieving from PACS...');
                }
                // Retry after a delay
                setTimeout(() => this.loadAndDisplayImage(index), 1000);
                return;
            }

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const blob = await response.blob();
            const imgUrl = URL.createObjectURL(blob);

            const img = new Image();
            img.onload = () => {
                this.currentImage = img;
                this.isLoadingImage = false;
                URL.revokeObjectURL(imgUrl);

                // Cache if no custom W/L
                if (this.state.windowCenter === null && this.state.windowWidth === null) {
                    if (!this.imageCache) this.imageCache = new Map();
                    this.imageCache.set(index, img);
                }

                this.render();
                this.updateOverlays();

                // Check if there's a pending image request from fast scrolling
                if (this.pendingImageIndex !== undefined && this.pendingImageIndex !== index) {
                    const pendingIdx = this.pendingImageIndex;
                    this.pendingImageIndex = undefined;
                    setTimeout(() => this.loadAndDisplayImage(pendingIdx), 10);
                    return;
                }

                // Preload adjacent images
                setTimeout(() => this.preloadAdjacentImages(index), 50);
            };
            img.onerror = () => {
                this.isLoadingImage = false;
                this.showMessage('Failed to load image');
            };
            img.src = imgUrl;

        } catch (error) {
            this.isLoadingImage = false;
            console.error('Error loading image:', error);
            this.showMessage(`Error: ${error.message}`);
        }
    }

    render() {
        if (!this.ctx) return;

        const { width, height } = this.canvas;
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);

        if (!this.currentImage) return;

        this.ctx.save();

        // Apply transformations
        this.ctx.translate(width / 2 + this.state.panX, height / 2 + this.state.panY);
        this.ctx.rotate(this.state.rotation * Math.PI / 180);
        this.ctx.scale(
            this.state.zoom * (this.state.flipH ? -1 : 1),
            this.state.zoom * (this.state.flipV ? -1 : 1)
        );

        // Calculate fit scale
        const scaleX = width / this.currentImage.width;
        const scaleY = height / this.currentImage.height;
        const scale = Math.min(scaleX, scaleY);

        const drawWidth = this.currentImage.width * scale;
        const drawHeight = this.currentImage.height * scale;

        // Draw image centered
        this.ctx.drawImage(
            this.currentImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        this.ctx.restore();

        // Apply invert filter
        if (this.state.invert) {
            this.ctx.globalCompositeOperation = 'difference';
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.globalCompositeOperation = 'source-over';
        }
    }

    /**
     * Render with client-side window/level adjustment (no server call)
     * Uses CSS filters for approximate W/L during drag
     */
    renderWithWindowLevel() {
        if (!this.ctx || !this.currentImage) return;

        const { width, height } = this.canvas;

        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);

        this.ctx.save();

        // Apply transformations
        this.ctx.translate(width / 2 + this.state.panX, height / 2 + this.state.panY);
        this.ctx.rotate(this.state.rotation * Math.PI / 180);
        this.ctx.scale(
            this.state.zoom * (this.state.flipH ? -1 : 1),
            this.state.zoom * (this.state.flipV ? -1 : 1)
        );

        // Calculate fit scale
        const scaleX = width / this.currentImage.width;
        const scaleY = height / this.currentImage.height;
        const scale = Math.min(scaleX, scaleY);
        const drawWidth = this.currentImage.width * scale;
        const drawHeight = this.currentImage.height * scale;

        // Calculate brightness and contrast from W/L
        // WL: Window Level (center), WW: Window Width
        const wl = this.state.windowCenter || 40;
        const ww = this.state.windowWidth || 400;

        // Approximate CSS filter values
        // Brightness: based on window level (0 = dark, 1 = normal, 2 = bright)
        const brightness = 1 + (wl - 40) / 200;
        // Contrast: based on window width (narrow = high contrast, wide = low contrast)
        const contrast = 400 / Math.max(1, ww);

        // Apply filter to canvas (approximate W/L effect)
        this.ctx.filter = `brightness(${Math.max(0.2, Math.min(3, brightness))}) contrast(${Math.max(0.2, Math.min(3, contrast))})`;

        // Draw image
        this.ctx.drawImage(
            this.currentImage,
            -drawWidth / 2,
            -drawHeight / 2,
            drawWidth,
            drawHeight
        );

        this.ctx.filter = 'none';
        this.ctx.restore();

        // Apply invert filter
        if (this.state.invert) {
            this.ctx.globalCompositeOperation = 'difference';
            this.ctx.fillStyle = 'white';
            this.ctx.fillRect(0, 0, width, height);
            this.ctx.globalCompositeOperation = 'source-over';
        }

        // Update W/L overlay
        this.updateOverlays();
    }

    /**
     * Schedule server W/L update (debounced)
     */
    scheduleServerWLUpdate() {
        // Clear any pending update
        if (this.wlUpdateTimer) {
            clearTimeout(this.wlUpdateTimer);
        }

        // Schedule new update after user stops adjusting
        this.wlUpdateTimer = setTimeout(() => {
            // Request server-rendered image with correct W/L
            this.loadAndDisplayImage(this.currentImageIndex);
        }, 300); // 300ms debounce
    }

    showMessage(message) {
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(message, this.canvas.width / 2, this.canvas.height / 2);
    }

    updateOverlays() {
        const idx = this.viewportId.split('-')[1] || '0';
        const sliceEl = document.getElementById(`overlay-slice-${idx}`);
        if (sliceEl) {
            sliceEl.textContent = `${this.currentImageIndex + 1} / ${this.imageStack.length}`;
        }

        const wlEl = document.getElementById(`overlay-wl-${idx}`);
        if (wlEl && this.state.windowCenter !== null) {
            wlEl.textContent = `W: ${Math.round(this.state.windowWidth)} L: ${Math.round(this.state.windowCenter)}`;
        }
    }


    nextImage() {
        if (this.currentImageIndex < this.imageStack.length - 1) {
            // Throttle rapid scrolling
            if (this.isLoadingImage) {
                this.pendingImageIndex = this.currentImageIndex + 1;
                return;
            }
            this.loadAndDisplayImage(this.currentImageIndex + 1);
        }
    }

    previousImage() {
        if (this.currentImageIndex > 0) {
            // Throttle rapid scrolling
            if (this.isLoadingImage) {
                this.pendingImageIndex = this.currentImageIndex - 1;
                return;
            }
            this.loadAndDisplayImage(this.currentImageIndex - 1);
        }
    }

    setWindowLevel(center, width) {
        this.state.windowCenter = center;
        this.state.windowWidth = width;
        // Use client-side rendering first, then schedule server update
        this.renderWithWindowLevel();
        this.scheduleServerWLUpdate();
    }

    setZoom(zoom) {
        this.state.zoom = zoom;
        this.render();
    }

    setPan(x, y) {
        this.state.panX = x;
        this.state.panY = y;
        this.render();
    }

    setRotation(angle) {
        this.state.rotation = angle;
        this.render();
    }

    flipHorizontal() {
        this.state.flipH = !this.state.flipH;
        this.render();
    }

    flipVertical() {
        this.state.flipV = !this.state.flipV;
        this.render();
    }

    invert() {
        this.state.invert = !this.state.invert;
        this.render();
    }

    reset() {
        this.state = {
            windowCenter: null,
            windowWidth: null,
            zoom: 1,
            panX: 0,
            panY: 0,
            rotation: 0,
            flipH: false,
            flipV: false,
            invert: false
        };
        this.loadAndDisplayImage(this.currentImageIndex);
    }

    destroy() {
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Export
window.initCornerstone = initCornerstone;
window.createRenderingEngine = createRenderingEngine;
window.FallbackViewport = FallbackViewport;

