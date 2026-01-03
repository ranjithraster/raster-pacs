/**
 * Multi-Planar Reconstruction (MPR) Viewer
 * Provides advanced viewing capabilities:
 * - Axial, Sagittal, Coronal views
 * - Stack scrolling (mouse/keyboard/touch)
 * - Window Level (WL) / Window Width (WW) presets
 * - Zoom, Pan, Rotate, Flip
 * - Cine loop playback
 * - Image inversion & grayscale mapping
 * - Series synchronization & reference lines
 * - Multi-monitor support
 */

class MPRViewer {
    constructor() {
        this.viewports = new Map();
        this.activeViewportId = null;
        this.currentSeries = null;
        this.synchronizer = null;
        this.referenceLineManager = null;
        this.cineController = null;
        this.grayscaleManager = null;
        this.multiMonitorManager = null;

        // View orientations
        this.orientations = {
            AXIAL: 'axial',
            SAGITTAL: 'sagittal',
            CORONAL: 'coronal'
        };

        // WL/WW Presets
        this.wlPresets = {
            brain: { center: 40, width: 80, name: 'Brain' },
            subdural: { center: 75, width: 215, name: 'Subdural' },
            stroke: { center: 40, width: 40, name: 'Stroke' },
            lung: { center: -600, width: 1500, name: 'Lung' },
            mediastinum: { center: 50, width: 350, name: 'Mediastinum' },
            bone: { center: 400, width: 1800, name: 'Bone' },
            softTissue: { center: 40, width: 400, name: 'Soft Tissue' },
            liver: { center: 60, width: 150, name: 'Liver' },
            abdomen: { center: 40, width: 350, name: 'Abdomen' },
            spine: { center: 50, width: 250, name: 'Spine' },
            pelvis: { center: 40, width: 400, name: 'Pelvis' },
            angio: { center: 300, width: 600, name: 'Angio' },
            cardiac: { center: 40, width: 400, name: 'Cardiac' }
        };

        // Grayscale LUT presets
        this.grayscaleLUTs = {
            linear: { name: 'Linear', type: 'linear' },
            sigmoid: { name: 'Sigmoid', type: 'sigmoid', params: { center: 0.5, width: 0.2 } },
            log: { name: 'Logarithmic', type: 'log' },
            exp: { name: 'Exponential', type: 'exp' },
            hot: { name: 'Hot Iron', type: 'colormap', colormap: 'hot' },
            cool: { name: 'Cool', type: 'colormap', colormap: 'cool' },
            rainbow: { name: 'Rainbow', type: 'colormap', colormap: 'rainbow' },
            pet: { name: 'PET', type: 'colormap', colormap: 'pet' }
        };

        // Touch gesture state
        this.touchState = {
            lastTouchDistance: 0,
            lastTouchCenter: { x: 0, y: 0 },
            isTouching: false
        };
    }

    /**
     * Initialize the MPR viewer
     */
    async initialize() {
        console.log('Initializing MPR Viewer...');

        // Initialize sub-managers
        this.synchronizer = new SeriesSynchronizer(this);
        this.referenceLineManager = new ReferenceLineManager(this);
        this.cineController = new CineController(this);
        this.grayscaleManager = new GrayscaleManager(this);
        this.multiMonitorManager = new MultiMonitorManager(this);

        // Setup keyboard shortcuts
        this.setupKeyboardShortcuts();

        // Setup touch gestures
        this.setupTouchGestures();

        console.log('MPR Viewer initialized');
    }

    /**
     * Setup MPR layout with three orthogonal views
     */
    async setupMPRLayout(studyUid, seriesUid, imageIds) {
        console.log('Setting up MPR layout');

        const grid = document.getElementById('viewportGrid');
        grid.className = 'viewport-grid mpr-layout';
        grid.innerHTML = '';

        // Create 2x2 grid: Axial, Sagittal, Coronal, 3D/Reference
        const layouts = [
            { id: 'axial', label: 'Axial', orientation: this.orientations.AXIAL },
            { id: 'sagittal', label: 'Sagittal', orientation: this.orientations.SAGITTAL },
            { id: 'coronal', label: 'Coronal', orientation: this.orientations.CORONAL },
            { id: 'reference', label: '3D Reference', orientation: null }
        ];

        for (let i = 0; i < layouts.length; i++) {
            const layout = layouts[i];
            const viewportEl = this.createMPRViewportElement(i, layout);
            grid.appendChild(viewportEl);
        }

        // Create viewport instances
        await this.createMPRViewports(studyUid, seriesUid, imageIds, layouts);

        // Enable synchronization
        this.synchronizer.enable();

        // Enable reference lines
        this.referenceLineManager.enable();

        this.activeViewportId = 'mpr-viewport-0';
        document.getElementById('mpr-viewport-0')?.classList.add('active');
    }

    /**
     * Create MPR viewport element with overlays
     */
    createMPRViewportElement(index, layout) {
        const viewportDiv = document.createElement('div');
        viewportDiv.className = 'viewport mpr-viewport';
        viewportDiv.id = `mpr-viewport-${index}`;
        viewportDiv.dataset.orientation = layout.orientation || 'reference';

        viewportDiv.innerHTML = `
            <div class="viewport-header">
                <span class="orientation-label">${layout.label}</span>
                <div class="viewport-actions">
                    <button class="vp-btn" onclick="mprViewer.maximizeViewport(${index})" title="Maximize">⛶</button>
                    <button class="vp-btn" onclick="mprViewer.resetViewport(${index})" title="Reset">↺</button>
                </div>
            </div>
            <div class="viewport-overlay top-left">
                <span id="mpr-overlay-patient-${index}"></span>
                <span id="mpr-overlay-study-${index}"></span>
            </div>
            <div class="viewport-overlay top-right">
                <span id="mpr-overlay-orientation-${index}">${layout.label}</span>
                <span id="mpr-overlay-thickness-${index}"></span>
            </div>
            <div class="viewport-overlay bottom-left">
                <span id="mpr-overlay-wl-${index}">WL: - WW: -</span>
                <span id="mpr-overlay-zoom-${index}">Zoom: 100%</span>
            </div>
            <div class="viewport-overlay bottom-right">
                <span id="mpr-overlay-slice-${index}">Slice: -/-</span>
                <span id="mpr-overlay-position-${index}"></span>
            </div>
            <div class="viewport-element" id="mpr-element-${index}"></div>
            <canvas class="reference-line-canvas" id="reference-canvas-${index}"></canvas>
            <div class="scroll-indicator" id="scroll-indicator-${index}">
                <div class="scroll-track">
                    <div class="scroll-thumb" id="scroll-thumb-${index}"></div>
                </div>
                <span class="scroll-label" id="scroll-label-${index}">1/1</span>
            </div>
        `;

        // Setup event handlers
        this.setupViewportEvents(viewportDiv, index, layout);

        return viewportDiv;
    }

    /**
     * Setup viewport event handlers for mouse, wheel, and keyboard
     */
    setupViewportEvents(viewportDiv, index, layout) {
        const element = viewportDiv;

        // Click to activate
        element.addEventListener('click', () => {
            this.setActiveViewport(`mpr-viewport-${index}`);
        });

        // Mouse wheel for scrolling
        element.addEventListener('wheel', (e) => {
            e.preventDefault();
            const delta = e.deltaY > 0 ? 1 : -1;
            this.scroll(index, delta);
        }, { passive: false });

        // Mouse drag for W/L, Pan, Zoom
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        let dragMode = null;

        element.addEventListener('mousedown', (e) => {
            isDragging = true;
            dragStart = { x: e.clientX, y: e.clientY };

            // Determine drag mode based on mouse button and modifiers
            if (e.button === 0 && !e.ctrlKey && !e.shiftKey) {
                dragMode = 'wl'; // Left click: Window/Level
            } else if (e.button === 1 || (e.button === 0 && e.ctrlKey)) {
                dragMode = 'pan'; // Middle click or Ctrl+Left: Pan
            } else if (e.button === 2 || (e.button === 0 && e.shiftKey)) {
                dragMode = 'zoom'; // Right click or Shift+Left: Zoom
            }

            element.classList.add('dragging');
        });

        element.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;

            switch (dragMode) {
                case 'wl':
                    this.adjustWindowLevel(index, dx, dy);
                    break;
                case 'pan':
                    this.pan(index, dx, dy);
                    break;
                case 'zoom':
                    this.zoom(index, dy);
                    break;
            }

            dragStart = { x: e.clientX, y: e.clientY };
        });

        element.addEventListener('mouseup', () => {
            isDragging = false;
            dragMode = null;
            element.classList.remove('dragging');
        });

        element.addEventListener('mouseleave', () => {
            isDragging = false;
            dragMode = null;
            element.classList.remove('dragging');
        });

        // Context menu (right-click)
        element.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.showContextMenu(e, index);
        });

        // Double-click to maximize
        element.addEventListener('dblclick', () => {
            this.maximizeViewport(index);
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (!this.activeViewportId) return;

            const viewport = this.getActiveViewport();
            if (!viewport) return;

            switch (e.key) {
                // Navigation
                case 'ArrowUp':
                case 'PageUp':
                    e.preventDefault();
                    this.scrollActive(-1);
                    break;
                case 'ArrowDown':
                case 'PageDown':
                    e.preventDefault();
                    this.scrollActive(1);
                    break;
                case 'Home':
                    e.preventDefault();
                    this.goToFirstSlice();
                    break;
                case 'End':
                    e.preventDefault();
                    this.goToLastSlice();
                    break;

                // Tools
                case 'w':
                case 'W':
                    this.setActiveTool('windowLevel');
                    break;
                case 'p':
                case 'P':
                    this.setActiveTool('pan');
                    break;
                case 'z':
                case 'Z':
                    this.setActiveTool('zoom');
                    break;
                case 's':
                case 'S':
                    this.setActiveTool('scroll');
                    break;

                // Image manipulation
                case 'r':
                case 'R':
                    this.resetViewportActive();
                    break;
                case 'i':
                case 'I':
                    this.invertActive();
                    break;
                case 'h':
                case 'H':
                    this.flipHorizontalActive();
                    break;
                case 'v':
                case 'V':
                    this.flipVerticalActive();
                    break;

                // Rotation
                case '[':
                    this.rotateActive(-90);
                    break;
                case ']':
                    this.rotateActive(90);
                    break;

                // Cine
                case ' ':
                    e.preventDefault();
                    this.cineController.toggle();
                    break;
                case '+':
                case '=':
                    this.cineController.increaseSpeed();
                    break;
                case '-':
                    this.cineController.decreaseSpeed();
                    break;

                // Presets (number keys)
                case '1':
                    this.applyWLPreset('brain');
                    break;
                case '2':
                    this.applyWLPreset('lung');
                    break;
                case '3':
                    this.applyWLPreset('bone');
                    break;
                case '4':
                    this.applyWLPreset('abdomen');
                    break;
                case '5':
                    this.applyWLPreset('liver');
                    break;

                // Layout
                case 'F1':
                    e.preventDefault();
                    this.setActiveViewport('mpr-viewport-0');
                    break;
                case 'F2':
                    e.preventDefault();
                    this.setActiveViewport('mpr-viewport-1');
                    break;
                case 'F3':
                    e.preventDefault();
                    this.setActiveViewport('mpr-viewport-2');
                    break;
                case 'F4':
                    e.preventDefault();
                    this.setActiveViewport('mpr-viewport-3');
                    break;

                // Synchronization
                case 'l':
                case 'L':
                    this.synchronizer.toggle();
                    break;
            }
        });
    }

    /**
     * Setup touch gestures for mobile/tablet support
     */
    setupTouchGestures() {
        const viewportGrid = document.getElementById('viewportGrid');
        if (!viewportGrid) return;

        viewportGrid.addEventListener('touchstart', (e) => {
            if (e.touches.length === 1) {
                // Single touch - prepare for scroll
                this.touchState.isTouching = true;
                this.touchState.lastTouchCenter = {
                    x: e.touches[0].clientX,
                    y: e.touches[0].clientY
                };
            } else if (e.touches.length === 2) {
                // Two touches - prepare for pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                this.touchState.lastTouchDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );
                this.touchState.lastTouchCenter = {
                    x: (touch1.clientX + touch2.clientX) / 2,
                    y: (touch1.clientY + touch2.clientY) / 2
                };
            }
        }, { passive: true });

        viewportGrid.addEventListener('touchmove', (e) => {
            e.preventDefault();

            if (e.touches.length === 1 && this.touchState.isTouching) {
                // Single touch - scroll or W/L
                const touch = e.touches[0];
                const dy = touch.clientY - this.touchState.lastTouchCenter.y;
                const dx = touch.clientX - this.touchState.lastTouchCenter.x;

                if (Math.abs(dy) > Math.abs(dx)) {
                    // Vertical swipe - scroll
                    if (Math.abs(dy) > 10) {
                        this.scrollActive(dy > 0 ? 1 : -1);
                        this.touchState.lastTouchCenter = { x: touch.clientX, y: touch.clientY };
                    }
                } else {
                    // Horizontal swipe - adjust window
                    const activeIdx = this.getActiveViewportIndex();
                    if (activeIdx !== null) {
                        this.adjustWindowLevel(activeIdx, dx * 2, 0);
                    }
                }

                this.touchState.lastTouchCenter = { x: touch.clientX, y: touch.clientY };

            } else if (e.touches.length === 2) {
                // Two touches - pinch zoom
                const touch1 = e.touches[0];
                const touch2 = e.touches[1];
                const currentDistance = Math.hypot(
                    touch2.clientX - touch1.clientX,
                    touch2.clientY - touch1.clientY
                );

                const scale = currentDistance / this.touchState.lastTouchDistance;
                const activeIdx = this.getActiveViewportIndex();
                if (activeIdx !== null) {
                    this.zoom(activeIdx, (scale - 1) * 100);
                }

                this.touchState.lastTouchDistance = currentDistance;
            }
        }, { passive: false });

        viewportGrid.addEventListener('touchend', () => {
            this.touchState.isTouching = false;
        });
    }

    /**
     * Create MPR viewports
     */
    async createMPRViewports(studyUid, seriesUid, imageIds, layouts) {
        // Create viewports first
        for (let i = 0; i < layouts.length; i++) {
            const layout = layouts[i];
            const element = document.getElementById(`mpr-element-${i}`);

            if (!element) continue;

            const viewport = new MPRViewport({
                id: `mpr-viewport-${i}`,
                element: element,
                orientation: layout.orientation,
                imageIds: imageIds,
                studyUid: studyUid,
                seriesUid: seriesUid
            });

            await viewport.initialize();
            this.viewports.set(`mpr-viewport-${i}`, viewport);

            // Setup scroll indicator
            this.setupScrollIndicator(i, viewport);
        }

        // Now load volume data for sagittal/coronal reconstruction
        if (imageIds && imageIds.length > 0) {
            await this.loadVolumeForMPR(imageIds);
        }
    }

    /**
     * Load volume data for MPR reconstruction
     */
    async loadVolumeForMPR(imageIds) {
        console.log('Loading volume for MPR with', imageIds.length, 'images');

        const allSlices = [];
        let rows = 0, cols = 0;
        let rescaleSlope = 1, rescaleIntercept = 0;
        let windowCenter = 40, windowWidth = 400;

        // Load all images
        for (let i = 0; i < imageIds.length; i++) {
            try {
                const imageId = imageIds[i];
                const url = imageId.replace('wadouri:', '');

                // Update loading progress
                const progress = ((i + 1) / imageIds.length) * 100;
                this.updateLoadingProgress(progress);

                const response = await fetch(url);
                if (!response.ok) {
                    console.warn('Failed to fetch slice', i, 'status:', response.status);
                    continue;
                }

                const arrayBuffer = await response.arrayBuffer();
                const sliceData = await this.parseSliceForVolume(arrayBuffer, i);

                if (sliceData) {
                    allSlices.push(sliceData);
                    rows = sliceData.rows;
                    cols = sliceData.cols;
                    rescaleSlope = sliceData.rescaleSlope;
                    rescaleIntercept = sliceData.rescaleIntercept;
                    windowCenter = sliceData.windowCenter;
                    windowWidth = sliceData.windowWidth;
                }
            } catch (error) {
                console.warn('Error loading slice', i, error);
            }
        }

        if (allSlices.length === 0) {
            console.warn('No slices loaded for MPR');
            showToast('MPR Error', 'Failed to load volume data', 'error');
            return;
        }

        console.log('Loaded', allSlices.length, 'slices for MPR, dimensions:', cols, 'x', rows);

        // Sort slices by slice location or instance number for proper volume ordering
        allSlices.sort((a, b) => {
            // First try slice location
            if (a.sliceLocation !== undefined && b.sliceLocation !== undefined) {
                return a.sliceLocation - b.sliceLocation;
            }
            // Fall back to image position patient Z coordinate
            if (a.imagePositionZ !== undefined && b.imagePositionZ !== undefined) {
                return a.imagePositionZ - b.imagePositionZ;
            }
            // Fall back to instance number
            return (a.instanceNumber || 0) - (b.instanceNumber || 0);
        });

        // Combine into 3D volume
        const sliceSize = rows * cols;
        const volumeData = new Float32Array(sliceSize * allSlices.length);

        for (let z = 0; z < allSlices.length; z++) {
            const slice = allSlices[z];
            for (let i = 0; i < sliceSize; i++) {
                volumeData[z * sliceSize + i] = slice.pixelData[i];
            }
        }

        const dimensions = {
            rows: rows,
            cols: cols,
            slices: allSlices.length
        };

        const rescaleParams = {
            slope: rescaleSlope,
            intercept: rescaleIntercept
        };

        // Set volume data on sagittal and coronal viewports for MPR
        for (const [id, viewport] of this.viewports) {
            if (viewport.orientation === 'sagittal' || viewport.orientation === 'coronal') {
                viewport.setVolumeData(volumeData, dimensions, rescaleParams);
                viewport.setWindowLevel(windowCenter, windowWidth);

                // Update scroll indicator after volume is loaded
                const index = parseInt(id.split('-').pop());
                this.updateScrollIndicator(index, viewport);
            }
        }

        // Also pass the volume to the axial viewport for consistency
        const axialViewport = this.viewports.get('mpr-viewport-0');
        if (axialViewport) {
            axialViewport.setVolumeData(volumeData, dimensions, rescaleParams);
        }

        console.log('MPR volume loading complete');
        showToast('MPR Ready', 'Volume loaded - Sagittal and Coronal views available', 'success');
    }

    /**
     * Parse a single DICOM slice for volume building
     */
    async parseSliceForVolume(arrayBuffer, sliceIndex) {
        try {
            const byteArray = new Uint8Array(arrayBuffer);
            const dataSet = dicomParser.parseDicom(byteArray);

            const pixelDataElement = dataSet.elements.x7fe00010;
            if (!pixelDataElement) {
                console.warn('No pixel data found in slice', sliceIndex);
                return null;
            }

            const rows = dataSet.uint16('x00280010');
            const cols = dataSet.uint16('x00280011');
            const bitsAllocated = dataSet.uint16('x00280100');
            const pixelRepresentation = dataSet.uint16('x00280103');
            const rescaleSlope = parseFloat(dataSet.string('x00281053')) || 1;
            const rescaleIntercept = parseFloat(dataSet.string('x00281052')) || 0;
            const windowCenter = parseFloat(dataSet.string('x00281050')?.split('\\')[0]) || 40;
            const windowWidth = parseFloat(dataSet.string('x00281051')?.split('\\')[0]) || 400;

            // Get slice location/position for proper ordering
            const sliceLocation = parseFloat(dataSet.string('x00201041')) || undefined;
            const instanceNumber = dataSet.intString('x00200013') || sliceIndex;

            // Get Image Position Patient (x, y, z)
            const imagePositionStr = dataSet.string('x00200032');
            let imagePositionZ = undefined;
            if (imagePositionStr) {
                const parts = imagePositionStr.split('\\');
                if (parts.length >= 3) {
                    imagePositionZ = parseFloat(parts[2]);
                }
            }

            let pixelData;
            if (bitsAllocated === 16) {
                if (pixelRepresentation === 0) {
                    pixelData = new Uint16Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
                } else {
                    pixelData = new Int16Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
                }
            } else {
                pixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
            }

            return {
                rows,
                cols,
                pixelData,
                rescaleSlope,
                rescaleIntercept,
                windowCenter,
                windowWidth,
                sliceLocation,
                imagePositionZ,
                instanceNumber
            };
        } catch (error) {
            console.error('Error parsing slice:', sliceIndex, error);
            return null;
        }
    }

    /**
     * Update loading progress on non-axial viewports
     */
    updateLoadingProgress(progress) {
        for (const [id, viewport] of this.viewports) {
            if (viewport.orientation !== 'axial' && !viewport.volumeLoaded) {
                viewport.loadingProgress = progress;
                viewport.showLoadingMessage();
            }
        }
    }

    /**
     * Setup scroll indicator for viewport
     */
    setupScrollIndicator(index, viewport) {
        const thumb = document.getElementById(`scroll-thumb-${index}`);
        const track = thumb?.parentElement;

        if (!track || !thumb) return;

        // Make thumb draggable
        let isDragging = false;

        thumb.addEventListener('mousedown', (e) => {
            isDragging = true;
            e.stopPropagation();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const rect = track.getBoundingClientRect();
            const percent = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height));
            const sliceIndex = Math.floor(percent * (viewport.totalSlices - 1));

            viewport.setSlice(sliceIndex);
            this.updateScrollIndicator(index, viewport);
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
        });

        // Click on track to jump
        track.addEventListener('click', (e) => {
            if (e.target === thumb) return;

            const rect = track.getBoundingClientRect();
            const percent = (e.clientY - rect.top) / rect.height;
            const sliceIndex = Math.floor(percent * (viewport.totalSlices - 1));

            viewport.setSlice(sliceIndex);
            this.updateScrollIndicator(index, viewport);
        });
    }

    /**
     * Update scroll indicator position
     */
    updateScrollIndicator(index, viewport) {
        const thumb = document.getElementById(`scroll-thumb-${index}`);
        const label = document.getElementById(`scroll-label-${index}`);

        if (thumb && viewport) {
            const percent = viewport.currentSlice / Math.max(1, viewport.totalSlices - 1);
            thumb.style.top = `${percent * 100}%`;
        }

        if (label && viewport) {
            label.textContent = `${viewport.currentSlice + 1}/${viewport.totalSlices}`;
        }

        // Update overlay
        const sliceOverlay = document.getElementById(`mpr-overlay-slice-${index}`);
        if (sliceOverlay && viewport) {
            sliceOverlay.textContent = `Slice: ${viewport.currentSlice + 1}/${viewport.totalSlices}`;
        }
    }

    /**
     * Scroll viewport by delta slices
     */
    scroll(viewportIndex, delta) {
        const viewport = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        viewport.scroll(delta);
        this.updateScrollIndicator(viewportIndex, viewport);

        // Trigger synchronization if enabled
        if (this.synchronizer.isEnabled) {
            this.synchronizer.syncFromViewport(viewportIndex);
        }

        // Update reference lines
        this.referenceLineManager.update();
    }

    /**
     * Scroll active viewport
     */
    scrollActive(delta) {
        const index = this.getActiveViewportIndex();
        if (index !== null) {
            this.scroll(index, delta);
        }
    }

    /**
     * Get active viewport index
     */
    getActiveViewportIndex() {
        if (!this.activeViewportId) return null;
        const match = this.activeViewportId.match(/mpr-viewport-(\d+)/);
        return match ? parseInt(match[1]) : null;
    }

    /**
     * Set active viewport
     */
    setActiveViewport(viewportId) {
        // Remove active class from all
        document.querySelectorAll('.mpr-viewport').forEach(el => {
            el.classList.remove('active');
        });

        // Add active class
        const element = document.getElementById(viewportId);
        if (element) {
            element.classList.add('active');
        }

        this.activeViewportId = viewportId;
    }

    /**
     * Get active viewport
     */
    getActiveViewport() {
        return this.viewports.get(this.activeViewportId);
    }

    /**
     * Adjust window level
     */
    adjustWindowLevel(viewportIndex, dx, dy) {
        const viewport = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        // dx adjusts window width, dy adjusts window center
        viewport.adjustWindowLevel(dx, -dy);
        this.updateWLOverlay(viewportIndex, viewport);

        // Sync W/L to other viewports if synchronization is enabled
        if (this.synchronizer.isEnabled) {
            this.synchronizer.syncWindowLevel(viewportIndex);
        }
    }

    /**
     * Update W/L overlay
     */
    updateWLOverlay(viewportIndex, viewport) {
        const overlay = document.getElementById(`mpr-overlay-wl-${viewportIndex}`);
        if (overlay && viewport) {
            overlay.textContent = `WL: ${Math.round(viewport.windowCenter)} WW: ${Math.round(viewport.windowWidth)}`;
        }
    }

    /**
     * Apply W/L preset
     */
    applyWLPreset(presetName) {
        const preset = this.wlPresets[presetName];
        if (!preset) return;

        const viewport = this.getActiveViewport();
        if (!viewport) return;

        viewport.setWindowLevel(preset.center, preset.width);

        const index = this.getActiveViewportIndex();
        if (index !== null) {
            this.updateWLOverlay(index, viewport);
        }

        showToast(`Applied ${preset.name} preset`, 'info');
    }

    /**
     * Pan viewport
     */
    pan(viewportIndex, dx, dy) {
        const viewport = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        viewport.pan(dx, dy);
    }

    /**
     * Zoom viewport
     */
    zoom(viewportIndex, delta) {
        const viewport = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        viewport.zoom(delta);
        this.updateZoomOverlay(viewportIndex, viewport);
    }

    /**
     * Update zoom overlay
     */
    updateZoomOverlay(viewportIndex, viewport) {
        const overlay = document.getElementById(`mpr-overlay-zoom-${viewportIndex}`);
        if (overlay && viewport) {
            overlay.textContent = `Zoom: ${Math.round(viewport.scale * 100)}%`;
        }
    }

    /**
     * Reset viewport
     */
    resetViewport(viewportIndex) {
        const viewport = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        viewport.reset();
        this.updateWLOverlay(viewportIndex, viewport);
        this.updateZoomOverlay(viewportIndex, viewport);
        this.updateScrollIndicator(viewportIndex, viewport);
    }

    /**
     * Reset active viewport
     */
    resetViewportActive() {
        const index = this.getActiveViewportIndex();
        if (index !== null) {
            this.resetViewport(index);
        }
    }

    /**
     * Invert active viewport
     */
    invertActive() {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.invert();
        }
    }

    /**
     * Flip horizontal active viewport
     */
    flipHorizontalActive() {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.flipHorizontal();
        }
    }

    /**
     * Flip vertical active viewport
     */
    flipVerticalActive() {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.flipVertical();
        }
    }

    /**
     * Rotate active viewport
     */
    rotateActive(angle) {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.rotate(angle);
        }
    }

    /**
     * Go to first slice
     */
    goToFirstSlice() {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.setSlice(0);
            const index = this.getActiveViewportIndex();
            if (index !== null) {
                this.updateScrollIndicator(index, viewport);
            }
        }
    }

    /**
     * Go to last slice
     */
    goToLastSlice() {
        const viewport = this.getActiveViewport();
        if (viewport) {
            viewport.setSlice(viewport.totalSlices - 1);
            const index = this.getActiveViewportIndex();
            if (index !== null) {
                this.updateScrollIndicator(index, viewport);
            }
        }
    }

    /**
     * Maximize viewport
     */
    maximizeViewport(viewportIndex) {
        const grid = document.getElementById('viewportGrid');
        const viewport = document.getElementById(`mpr-viewport-${viewportIndex}`);

        if (!grid || !viewport) return;

        if (viewport.classList.contains('maximized')) {
            // Restore
            viewport.classList.remove('maximized');
            grid.classList.remove('has-maximized');
            document.querySelectorAll('.mpr-viewport').forEach(el => {
                el.style.display = '';
            });
        } else {
            // Maximize
            document.querySelectorAll('.mpr-viewport').forEach(el => {
                el.style.display = el === viewport ? '' : 'none';
            });
            viewport.classList.add('maximized');
            grid.classList.add('has-maximized');
        }

        // Trigger resize
        const vp = this.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (vp) {
            setTimeout(() => vp.resize(), 100);
        }
    }

    /**
     * Show context menu
     */
    showContextMenu(event, viewportIndex) {
        // Remove existing menu
        const existing = document.getElementById('viewport-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.id = 'viewport-context-menu';
        menu.className = 'context-menu';
        menu.innerHTML = `
            <div class="context-menu-section">
                <span class="section-title">Window/Level</span>
                ${Object.entries(this.wlPresets).slice(0, 6).map(([key, preset]) => `
                    <button onclick="mprViewer.applyWLPreset('${key}')">${preset.name}</button>
                `).join('')}
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-section">
                <span class="section-title">Image</span>
                <button onclick="mprViewer.resetViewport(${viewportIndex})">Reset</button>
                <button onclick="mprViewer.invertActive()">Invert</button>
                <button onclick="mprViewer.flipHorizontalActive()">Flip H</button>
                <button onclick="mprViewer.flipVerticalActive()">Flip V</button>
                <button onclick="mprViewer.rotateActive(90)">Rotate 90°</button>
            </div>
            <div class="context-menu-divider"></div>
            <div class="context-menu-section">
                <button onclick="mprViewer.maximizeViewport(${viewportIndex})">Maximize</button>
            </div>
        `;

        menu.style.left = `${event.clientX}px`;
        menu.style.top = `${event.clientY}px`;

        document.body.appendChild(menu);

        // Close on click outside
        const closeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        };

        setTimeout(() => {
            document.addEventListener('click', closeMenu);
        }, 0);
    }

    /**
     * Set active tool
     */
    setActiveTool(toolName) {
        this.viewports.forEach(vp => {
            vp.setActiveTool(toolName);
        });
    }

    /**
     * Apply grayscale LUT
     */
    applyGrayscaleLUT(lutName) {
        const lut = this.grayscaleLUTs[lutName];
        if (!lut) return;

        this.grayscaleManager.applyLUT(lut);
    }

    /**
     * Open in new window for multi-monitor
     */
    openInNewWindow(viewportIndex) {
        this.multiMonitorManager.openViewportInWindow(viewportIndex);
    }
}


/**
 * MPR Viewport - Individual viewport for MPR viewing
 * Supports true multi-planar reconstruction with axial, sagittal, and coronal views
 */
class MPRViewport {
    constructor(options) {
        this.id = options.id;
        this.element = options.element;
        this.orientation = options.orientation; // 'axial', 'sagittal', or 'coronal'
        this.imageIds = options.imageIds || [];
        this.studyUid = options.studyUid;
        this.seriesUid = options.seriesUid;

        this.currentSlice = 0;
        this.totalSlices = this.imageIds.length;

        this.windowCenter = 40;
        this.windowWidth = 400;
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.rotation = 0;
        this.isInverted = false;
        this.flipH = false;
        this.flipV = false;

        this.canvas = null;
        this.ctx = null;
        this.currentImage = null;
        this.imageCache = new Map();

        // Volume data for MPR reconstruction
        this.volumeData = null;
        this.volumeDimensions = null; // { rows, cols, slices }
        this.volumeLoaded = false;
        this.loadingProgress = 0;
    }

    async initialize() {
        // Create canvas
        this.canvas = document.createElement('canvas');
        this.canvas.className = 'viewport-canvas';
        this.element.appendChild(this.canvas);
        this.ctx = this.canvas.getContext('2d');

        // Setup resize observer
        this.resizeObserver = new ResizeObserver(() => this.resize());
        this.resizeObserver.observe(this.element);

        this.resize();

        // For axial view, load first image; for sagittal/coronal, wait for volume
        // For reference viewport (null orientation), show placeholder
        if (this.imageIds.length > 0) {
            if (this.orientation === 'axial') {
                await this.loadAndDisplayImage(0);
            } else if (this.orientation === null) {
                // Reference/3D viewport - show placeholder
                this.showReferenceViewPlaceholder();
            } else {
                // Show loading message for sagittal/coronal views
                this.showLoadingMessage();
            }
        } else if (this.orientation === null) {
            this.showReferenceViewPlaceholder();
        }
    }

    showReferenceViewPlaceholder() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.fillStyle = '#111';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#666';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('3D Reference View', this.canvas.width / 2, this.canvas.height / 2 - 10);
        this.ctx.font = '12px Arial';
        this.ctx.fillText('(Coming soon)', this.canvas.width / 2, this.canvas.height / 2 + 10);
    }

    showLoadingMessage() {
        if (!this.ctx || !this.canvas) return;

        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.fillStyle = '#888';
        this.ctx.font = '14px Arial';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('Loading volume data...', this.canvas.width / 2, this.canvas.height / 2);
        if (this.loadingProgress > 0) {
            this.ctx.fillText(`${Math.round(this.loadingProgress)}%`, this.canvas.width / 2, this.canvas.height / 2 + 20);
        }
    }

    resize() {
        const rect = this.element.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    async loadAndDisplayImage(index) {
        if (index < 0 || index >= this.imageIds.length) return;

        this.currentSlice = index;

        // Check cache
        if (this.imageCache.has(index)) {
            this.currentImage = this.imageCache.get(index);
            this.render();
            return;
        }

        try {
            const imageId = this.imageIds[index];
            // Extract URL from wadouri:
            const url = imageId.replace('wadouri:', '');

            const response = await fetch(url);
            if (!response.ok) throw new Error('Failed to load image');

            const arrayBuffer = await response.arrayBuffer();
            const image = await this.parseAndCreateImage(arrayBuffer);

            this.currentImage = image;
            this.imageCache.set(index, image);

            // Auto window level on first image
            if (this.windowCenter === 40 && this.windowWidth === 400 && image.windowCenter) {
                this.windowCenter = image.windowCenter;
                this.windowWidth = image.windowWidth;
            }

            this.render();

        } catch (error) {
            console.error('Error loading image:', error);
        }
    }

    async parseAndCreateImage(arrayBuffer) {
        // Use dicomParser to parse
        const byteArray = new Uint8Array(arrayBuffer);
        const dataSet = dicomParser.parseDicom(byteArray);

        // Get pixel data
        const pixelDataElement = dataSet.elements.x7fe00010;
        const rows = dataSet.uint16('x00280010');
        const cols = dataSet.uint16('x00280011');
        const bitsAllocated = dataSet.uint16('x00280100');
        const bitsStored = dataSet.uint16('x00280101');
        const pixelRepresentation = dataSet.uint16('x00280103');
        const rescaleSlope = parseFloat(dataSet.string('x00281053')) || 1;
        const rescaleIntercept = parseFloat(dataSet.string('x00281052')) || 0;
        const windowCenter = parseFloat(dataSet.string('x00281050')?.split('\\')[0]) || 40;
        const windowWidth = parseFloat(dataSet.string('x00281051')?.split('\\')[0]) || 400;

        // Create typed array for pixel data
        let pixelData;
        if (bitsAllocated === 16) {
            if (pixelRepresentation === 0) {
                pixelData = new Uint16Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
            } else {
                pixelData = new Int16Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
            }
        } else {
            pixelData = new Uint8Array(arrayBuffer, pixelDataElement.dataOffset, rows * cols);
        }

        return {
            rows,
            cols,
            pixelData,
            bitsAllocated,
            rescaleSlope,
            rescaleIntercept,
            windowCenter,
            windowWidth,
            minPixelValue: Math.min(...Array.from(pixelData).slice(0, 1000)),
            maxPixelValue: Math.max(...Array.from(pixelData).slice(0, 1000))
        };
    }

    /**
     * Set volume data for MPR reconstruction (sagittal/coronal views)
     */
    setVolumeData(volumeData, dimensions, rescaleParams) {
        this.volumeData = volumeData;
        this.volumeDimensions = dimensions;
        this.rescaleSlope = rescaleParams?.slope || 1;
        this.rescaleIntercept = rescaleParams?.intercept || 0;
        this.volumeLoaded = true;

        // Update total slices based on orientation
        if (this.orientation === 'sagittal') {
            this.totalSlices = dimensions.cols;
            this.currentSlice = Math.floor(dimensions.cols / 2);
        } else if (this.orientation === 'coronal') {
            this.totalSlices = dimensions.rows;
            this.currentSlice = Math.floor(dimensions.rows / 2);
        } else {
            this.totalSlices = dimensions.slices;
        }

        this.render();
    }

    /**
     * Extract a slice from volume data based on orientation
     */
    extractSliceFromVolume(sliceIndex) {
        if (!this.volumeData || !this.volumeDimensions) return null;

        const { rows, cols, slices } = this.volumeDimensions;
        const sliceSize = rows * cols;

        if (this.orientation === 'axial') {
            // Axial: XY plane at Z position
            const clampedIndex = Math.max(0, Math.min(slices - 1, sliceIndex));
            const startIdx = clampedIndex * sliceSize;
            return {
                pixelData: this.volumeData.slice(startIdx, startIdx + sliceSize),
                width: cols,
                height: rows
            };
        } else if (this.orientation === 'sagittal') {
            // Sagittal: YZ plane at X position (left-right slice)
            const clampedIndex = Math.max(0, Math.min(cols - 1, sliceIndex));
            const pixelData = new Float32Array(rows * slices);

            for (let z = 0; z < slices; z++) {
                for (let y = 0; y < rows; y++) {
                    const srcIdx = z * sliceSize + y * cols + clampedIndex;
                    const dstIdx = (slices - 1 - z) * rows + y; // Flip Z for proper orientation
                    pixelData[dstIdx] = this.volumeData[srcIdx];
                }
            }

            return {
                pixelData: pixelData,
                width: rows,
                height: slices
            };
        } else if (this.orientation === 'coronal') {
            // Coronal: XZ plane at Y position (front-back slice)
            const clampedIndex = Math.max(0, Math.min(rows - 1, sliceIndex));
            const pixelData = new Float32Array(cols * slices);

            for (let z = 0; z < slices; z++) {
                for (let x = 0; x < cols; x++) {
                    const srcIdx = z * sliceSize + clampedIndex * cols + x;
                    const dstIdx = (slices - 1 - z) * cols + x; // Flip Z for proper orientation
                    pixelData[dstIdx] = this.volumeData[srcIdx];
                }
            }

            return {
                pixelData: pixelData,
                width: cols,
                height: slices
            };
        }

        return null;
    }

    render() {
        if (!this.ctx || !this.canvas) return;

        const ctx = this.ctx;
        const canvas = this.canvas;

        // Clear
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // For reference viewport, show placeholder
        if (this.orientation === null) {
            this.showReferenceViewPlaceholder();
            return;
        }

        // For sagittal/coronal views, use volume data if available
        if ((this.orientation === 'sagittal' || this.orientation === 'coronal') && this.volumeLoaded) {
            this.renderFromVolume();
            return;
        }

        if (!this.currentImage) return;

        const image = this.currentImage;

        // Create image data
        const imageData = ctx.createImageData(image.cols, image.rows);
        const data = imageData.data;

        // Apply window level
        const wc = this.windowCenter;
        const ww = this.windowWidth;
        const lower = wc - ww / 2;
        const upper = wc + ww / 2;

        for (let i = 0; i < image.pixelData.length; i++) {
            let value = image.pixelData[i] * image.rescaleSlope + image.rescaleIntercept;

            // Apply window level
            if (value <= lower) {
                value = 0;
            } else if (value >= upper) {
                value = 255;
            } else {
                value = ((value - lower) / ww) * 255;
            }

            // Apply inversion
            if (this.isInverted) {
                value = 255 - value;
            }

            const idx = i * 4;
            data[idx] = value;     // R
            data[idx + 1] = value; // G
            data[idx + 2] = value; // B
            data[idx + 3] = 255;   // A
        }

        // Create temp canvas for transforms
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = image.cols;
        tempCanvas.height = image.rows;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Apply transforms
        ctx.save();
        ctx.translate(canvas.width / 2 + this.panX, canvas.height / 2 + this.panY);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.scale(this.flipH ? -this.scale : this.scale, this.flipV ? -this.scale : this.scale);

        // Fit to viewport
        const aspectRatio = image.cols / image.rows;
        const canvasAspectRatio = canvas.width / canvas.height;
        let drawWidth, drawHeight;

        if (aspectRatio > canvasAspectRatio) {
            drawWidth = canvas.width * 0.9;
            drawHeight = drawWidth / aspectRatio;
        } else {
            drawHeight = canvas.height * 0.9;
            drawWidth = drawHeight * aspectRatio;
        }

        ctx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
    }

    /**
     * Render a slice from volume data (for sagittal/coronal views)
     */
    renderFromVolume() {
        const ctx = this.ctx;
        const canvas = this.canvas;

        const sliceData = this.extractSliceFromVolume(this.currentSlice);
        if (!sliceData) return;

        const { pixelData, width, height } = sliceData;

        // Create image data
        const imageData = ctx.createImageData(width, height);
        const data = imageData.data;

        // Apply window level
        const wc = this.windowCenter;
        const ww = this.windowWidth;
        const lower = wc - ww / 2;
        const upper = wc + ww / 2;
        const slope = this.rescaleSlope || 1;
        const intercept = this.rescaleIntercept || 0;

        for (let i = 0; i < pixelData.length; i++) {
            let value = pixelData[i] * slope + intercept;

            // Apply window level
            if (value <= lower) {
                value = 0;
            } else if (value >= upper) {
                value = 255;
            } else {
                value = ((value - lower) / ww) * 255;
            }

            // Apply inversion
            if (this.isInverted) {
                value = 255 - value;
            }

            const idx = i * 4;
            data[idx] = value;     // R
            data[idx + 1] = value; // G
            data[idx + 2] = value; // B
            data[idx + 3] = 255;   // A
        }

        // Create temp canvas for transforms
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = width;
        tempCanvas.height = height;
        const tempCtx = tempCanvas.getContext('2d');
        tempCtx.putImageData(imageData, 0, 0);

        // Apply transforms
        ctx.save();
        ctx.translate(canvas.width / 2 + this.panX, canvas.height / 2 + this.panY);
        ctx.rotate(this.rotation * Math.PI / 180);
        ctx.scale(this.flipH ? -this.scale : this.scale, this.flipV ? -this.scale : this.scale);

        // Fit to viewport
        const aspectRatio = width / height;
        const canvasAspectRatio = canvas.width / canvas.height;
        let drawWidth, drawHeight;

        if (aspectRatio > canvasAspectRatio) {
            drawWidth = canvas.width * 0.9;
            drawHeight = drawWidth / aspectRatio;
        } else {
            drawHeight = canvas.height * 0.9;
            drawWidth = drawHeight * aspectRatio;
        }

        ctx.drawImage(tempCanvas, -drawWidth / 2, -drawHeight / 2, drawWidth, drawHeight);
        ctx.restore();
    }

    scroll(delta) {
        const newSlice = Math.max(0, Math.min(this.totalSlices - 1, this.currentSlice + delta));
        if (newSlice !== this.currentSlice) {
            this.currentSlice = newSlice;
            // For axial view, load image from URL; for sagittal/coronal, re-render from volume
            if (this.orientation === 'axial' && !this.volumeLoaded) {
                this.loadAndDisplayImage(newSlice);
            } else {
                this.render();
            }
        }
    }

    setSlice(index) {
        if (index >= 0 && index < this.totalSlices) {
            this.currentSlice = index;
            if (this.orientation === 'axial' && !this.volumeLoaded) {
                this.loadAndDisplayImage(index);
            } else {
                this.render();
            }
        }
    }

    adjustWindowLevel(dx, dy) {
        this.windowWidth = Math.max(1, this.windowWidth + dx * 2);
        this.windowCenter = this.windowCenter + dy * 2;
        this.render();
    }

    setWindowLevel(center, width) {
        this.windowCenter = center;
        this.windowWidth = width;
        this.render();
    }

    pan(dx, dy) {
        this.panX += dx;
        this.panY += dy;
        this.render();
    }

    zoom(delta) {
        const zoomFactor = 1 + delta / 500;
        this.scale = Math.max(0.1, Math.min(10, this.scale * zoomFactor));
        this.render();
    }

    rotate(angle) {
        this.rotation = (this.rotation + angle) % 360;
        this.render();
    }

    flipHorizontal() {
        this.flipH = !this.flipH;
        this.render();
    }

    flipVertical() {
        this.flipV = !this.flipV;
        this.render();
    }

    invert() {
        this.isInverted = !this.isInverted;
        this.render();
    }

    reset() {
        this.scale = 1.0;
        this.panX = 0;
        this.panY = 0;
        this.rotation = 0;
        this.flipH = false;
        this.flipV = false;
        this.isInverted = false;

        if (this.currentImage) {
            this.windowCenter = this.currentImage.windowCenter || 40;
            this.windowWidth = this.currentImage.windowWidth || 400;
        }

        this.render();
    }

    setActiveTool(toolName) {
        // Tool handling is done at MPRViewer level
    }
}


/**
 * Series Synchronizer - Synchronizes scroll position and W/L across viewports
 */
class SeriesSynchronizer {
    constructor(viewer) {
        this.viewer = viewer;
        this.isEnabled = true;
        this.syncMode = 'position'; // 'position', 'slice', 'wl'
    }

    enable() {
        this.isEnabled = true;
    }

    disable() {
        this.isEnabled = false;
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        showToast(`Synchronization ${this.isEnabled ? 'enabled' : 'disabled'}`, 'info');
    }

    syncFromViewport(sourceIndex) {
        if (!this.isEnabled) return;

        const sourceViewport = this.viewer.viewports.get(`mpr-viewport-${sourceIndex}`);
        if (!sourceViewport) return;

        // For MPR, we sync based on 3D position
        // This is a simplified implementation
        this.viewer.viewports.forEach((vp, id) => {
            if (id === `mpr-viewport-${sourceIndex}`) return;

            // Sync slice position proportionally
            if (this.syncMode === 'slice' || this.syncMode === 'position') {
                const percent = sourceViewport.currentSlice / Math.max(1, sourceViewport.totalSlices - 1);
                const targetSlice = Math.floor(percent * (vp.totalSlices - 1));
                vp.setSlice(targetSlice);

                const idx = parseInt(id.split('-')[2]);
                this.viewer.updateScrollIndicator(idx, vp);
            }
        });
    }

    syncWindowLevel(sourceIndex) {
        if (!this.isEnabled) return;

        const sourceViewport = this.viewer.viewports.get(`mpr-viewport-${sourceIndex}`);
        if (!sourceViewport) return;

        this.viewer.viewports.forEach((vp, id) => {
            if (id === `mpr-viewport-${sourceIndex}`) return;

            vp.setWindowLevel(sourceViewport.windowCenter, sourceViewport.windowWidth);

            const idx = parseInt(id.split('-')[2]);
            this.viewer.updateWLOverlay(idx, vp);
        });
    }
}


/**
 * Reference Line Manager - Draws reference lines showing slice position across views
 */
class ReferenceLineManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.isEnabled = true;
        this.lineColor = '#00ff00';
        this.lineWidth = 2;
    }

    enable() {
        this.isEnabled = true;
        this.update();
    }

    disable() {
        this.isEnabled = false;
        this.clear();
    }

    toggle() {
        this.isEnabled = !this.isEnabled;
        if (this.isEnabled) {
            this.update();
        } else {
            this.clear();
        }
    }

    update() {
        if (!this.isEnabled) return;

        // Draw reference lines on each viewport
        this.viewer.viewports.forEach((vp, id) => {
            const idx = parseInt(id.split('-')[2]);
            this.drawReferenceLines(idx, vp);
        });
    }

    drawReferenceLines(viewportIndex, viewport) {
        const canvas = document.getElementById(`reference-canvas-${viewportIndex}`);
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        const rect = canvas.parentElement.getBoundingClientRect();

        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        if (!this.isEnabled) return;

        // Draw crosshairs for other viewports
        this.viewer.viewports.forEach((otherVp, otherId) => {
            if (otherId === `mpr-viewport-${viewportIndex}`) return;

            const otherIdx = parseInt(otherId.split('-')[2]);
            const color = this.getColorForViewport(otherIdx);

            // Calculate line position based on slice position
            const percent = otherVp.currentSlice / Math.max(1, otherVp.totalSlices - 1);

            // Draw horizontal and vertical lines
            ctx.strokeStyle = color;
            ctx.lineWidth = this.lineWidth;
            ctx.setLineDash([5, 5]);

            // Vertical line
            const x = canvas.width * percent;
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();
        });
    }

    getColorForViewport(index) {
        const colors = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
        return colors[index % colors.length];
    }

    clear() {
        for (let i = 0; i < 4; i++) {
            const canvas = document.getElementById(`reference-canvas-${i}`);
            if (canvas) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, canvas.width, canvas.height);
            }
        }
    }
}


/**
 * Cine Controller - Handles cine loop playback
 */
class CineController {
    constructor(viewer) {
        this.viewer = viewer;
        this.isPlaying = false;
        this.fps = 15;
        this.direction = 1; // 1 = forward, -1 = backward
        this.loopMode = 'loop'; // 'loop', 'bounce', 'once'
        this.intervalId = null;
    }

    play() {
        if (this.isPlaying) return;

        this.isPlaying = true;
        this.updateUI();

        this.intervalId = setInterval(() => {
            this.advanceFrame();
        }, 1000 / this.fps);
    }

    pause() {
        if (!this.isPlaying) return;

        this.isPlaying = false;
        this.updateUI();

        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    toggle() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    stop() {
        this.pause();
        this.viewer.goToFirstSlice();
    }

    advanceFrame() {
        const viewport = this.viewer.getActiveViewport();
        if (!viewport) return;

        const nextSlice = viewport.currentSlice + this.direction;

        if (nextSlice >= viewport.totalSlices) {
            if (this.loopMode === 'loop') {
                viewport.setSlice(0);
            } else if (this.loopMode === 'bounce') {
                this.direction = -1;
                viewport.scroll(this.direction);
            } else {
                this.pause();
            }
        } else if (nextSlice < 0) {
            if (this.loopMode === 'loop') {
                viewport.setSlice(viewport.totalSlices - 1);
            } else if (this.loopMode === 'bounce') {
                this.direction = 1;
                viewport.scroll(this.direction);
            } else {
                this.pause();
            }
        } else {
            viewport.scroll(this.direction);
        }

        const index = this.viewer.getActiveViewportIndex();
        if (index !== null) {
            this.viewer.updateScrollIndicator(index, viewport);
        }
    }

    setFPS(fps) {
        this.fps = Math.max(1, Math.min(60, fps));

        if (this.isPlaying) {
            this.pause();
            this.play();
        }

        this.updateUI();
    }

    increaseSpeed() {
        this.setFPS(this.fps + 5);
    }

    decreaseSpeed() {
        this.setFPS(this.fps - 5);
    }

    setLoopMode(mode) {
        this.loopMode = mode;
    }

    updateUI() {
        const playBtn = document.getElementById('cinePlayBtn');
        if (playBtn) {
            playBtn.textContent = this.isPlaying ? '⏸️' : '▶️';
        }

        const fpsLabel = document.getElementById('cineSpeedLabel');
        if (fpsLabel) {
            fpsLabel.textContent = `${this.fps} fps`;
        }
    }
}


/**
 * Grayscale Manager - Handles grayscale LUT and colormap application
 */
class GrayscaleManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.currentLUT = 'linear';
    }

    applyLUT(lut) {
        this.currentLUT = lut.type;

        // Apply to all viewports
        this.viewer.viewports.forEach(vp => {
            vp.colormap = lut.colormap || null;
            vp.lutType = lut.type;
            vp.render();
        });
    }

    createSigmoidLUT(center, width, size = 256) {
        const lut = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            const x = i / size;
            const v = 1 / (1 + Math.exp(-((x - center) / width)));
            lut[i] = Math.round(v * 255);
        }
        return lut;
    }

    createLogLUT(size = 256) {
        const lut = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            const v = Math.log(1 + i) / Math.log(size);
            lut[i] = Math.round(v * 255);
        }
        return lut;
    }

    createExpLUT(size = 256) {
        const lut = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            const v = (Math.exp(i / size) - 1) / (Math.E - 1);
            lut[i] = Math.round(v * 255);
        }
        return lut;
    }
}


/**
 * Multi-Monitor Manager - Handles multi-monitor support
 */
class MultiMonitorManager {
    constructor(viewer) {
        this.viewer = viewer;
        this.externalWindows = new Map();
    }

    openViewportInWindow(viewportIndex) {
        const viewport = this.viewer.viewports.get(`mpr-viewport-${viewportIndex}`);
        if (!viewport) return;

        // Get screen info
        const screenWidth = window.screen.availWidth;
        const screenHeight = window.screen.availHeight;

        // Open new window
        const newWindow = window.open('', `viewport_${viewportIndex}`,
            `width=${screenWidth/2},height=${screenHeight/2},left=${screenWidth/2},top=0`);

        if (!newWindow) {
            showToast('Pop-up blocked. Please allow pop-ups for multi-monitor support.', 'warning');
            return;
        }

        // Setup new window content
        newWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>MPR Viewport ${viewportIndex + 1}</title>
                <style>
                    body { margin: 0; background: #000; overflow: hidden; }
                    .viewport-container { width: 100vw; height: 100vh; }
                    canvas { width: 100%; height: 100%; }
                </style>
            </head>
            <body>
                <div class="viewport-container" id="external-viewport"></div>
            </body>
            </html>
        `);

        // Clone viewport to new window
        newWindow.addEventListener('load', () => {
            const container = newWindow.document.getElementById('external-viewport');
            const canvas = viewport.canvas.cloneNode(true);
            container.appendChild(canvas);

            // Sync updates
            this.syncViewportToWindow(viewportIndex, newWindow);
        });

        this.externalWindows.set(viewportIndex, newWindow);

        // Cleanup on close
        newWindow.addEventListener('beforeunload', () => {
            this.externalWindows.delete(viewportIndex);
        });
    }

    syncViewportToWindow(viewportIndex, targetWindow) {
        // This would sync viewport updates to the external window
        // Implementation depends on how often updates occur
    }

    closeAll() {
        this.externalWindows.forEach(win => win.close());
        this.externalWindows.clear();
    }
}


// Create global instance
const mprViewer = new MPRViewer();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    mprViewer.initialize();
});

