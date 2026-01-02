/**
 * Viewport Manager
 * Manages multiple viewports and their layouts
 */
class ViewportManager {
    constructor() {
        this.renderingEngine = null;
        this.viewports = new Map();
        this.activeViewportId = null;
        this.layout = { rows: 1, cols: 1 };
        this.loadedSeries = new Map(); // seriesUid -> viewport mapping
    }

    async initialize() {
        await initCornerstone();
        this.renderingEngine = createRenderingEngine('rasterPacsEngine');
        this.setupViewports(1, 1);
    }

    setupViewports(rows, cols) {
        const grid = document.getElementById('viewportGrid');

        // Update grid class
        grid.className = 'viewport-grid';
        if (rows === 1 && cols === 2) grid.classList.add('layout-1x2');
        else if (rows === 2 && cols === 2) grid.classList.add('layout-2x2');

        // Calculate number of viewports needed
        const count = rows * cols;

        // Clear existing viewports
        this.viewports.forEach(vp => {
            if (vp.destroy) vp.destroy();
        });
        this.viewports.clear();

        // Clear grid
        grid.innerHTML = '';

        // Create viewport elements
        const viewportInputs = [];
        for (let i = 0; i < count; i++) {
            const viewportDiv = document.createElement('div');
            viewportDiv.className = 'viewport';
            viewportDiv.id = `viewport-${i}`;
            viewportDiv.innerHTML = `
                <div class="viewport-overlay top-left">
                    <span id="overlay-patient-${i}"></span>
                    <span id="overlay-study-${i}"></span>
                </div>
                <div class="viewport-overlay top-right">
                    <span id="overlay-series-${i}"></span>
                    <span id="overlay-modality-${i}"></span>
                </div>
                <div class="viewport-overlay bottom-left">
                    <span id="overlay-wl-${i}"></span>
                    <span id="overlay-zoom-${i}"></span>
                </div>
                <div class="viewport-overlay bottom-right">
                    <span id="overlay-slice-${i}"></span>
                </div>
                <div class="viewport-element" id="viewport-element-${i}"></div>
                <div class="viewport-empty" id="viewport-empty-${i}">
                    <div class="empty-content">
                        <svg viewBox="0 0 24 24" width="48" height="48" fill="currentColor">
                            <path d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V5h14v14zm-5-7l-3 3.72L9 13l-3 4h12l-4-5z"/>
                        </svg>
                        <p>Drop series here</p>
                    </div>
                </div>
            `;

            grid.appendChild(viewportDiv);

            // Setup click handler for viewport selection
            viewportDiv.addEventListener('click', () => this.setActiveViewport(`viewport-${i}`));

            // Setup drop handler
            viewportDiv.addEventListener('dragover', (e) => {
                e.preventDefault();
                viewportDiv.classList.add('dragover');
            });
            viewportDiv.addEventListener('dragleave', () => {
                viewportDiv.classList.remove('dragover');
            });
            viewportDiv.addEventListener('drop', (e) => {
                e.preventDefault();
                viewportDiv.classList.remove('dragover');
                const data = JSON.parse(e.dataTransfer.getData('application/json'));
                this.loadSeries(data.studyUid, data.seriesUid, `viewport-${i}`);
            });

            viewportInputs.push({
                viewportId: `viewport-${i}`,
                element: document.getElementById(`viewport-element-${i}`),
                type: 'stack'
            });
        }

        // Setup viewports in rendering engine
        if (this.renderingEngine) {
            this.renderingEngine.setViewports(viewportInputs);

            // Store viewport references
            for (const input of viewportInputs) {
                const vp = this.renderingEngine.getViewport(input.viewportId);
                if (vp) {
                    this.viewports.set(input.viewportId, vp);
                }
            }
        }

        // Set first viewport as active
        this.setActiveViewport('viewport-0');

        this.layout = { rows, cols };
    }

    setActiveViewport(viewportId) {
        // Remove active class from all viewports
        document.querySelectorAll('.viewport').forEach(el => el.classList.remove('active'));

        // Add active class to selected viewport
        const viewportEl = document.getElementById(viewportId);
        if (viewportEl) {
            viewportEl.classList.add('active');
        }

        this.activeViewportId = viewportId;
    }

    getActiveViewport() {
        return this.viewports.get(this.activeViewportId);
    }

    async loadSeries(studyUid, seriesUid, viewportId = null) {
        const targetViewportId = viewportId || this.activeViewportId;
        const viewport = this.viewports.get(targetViewportId);

        if (!viewport) {
            console.error('Viewport not found:', targetViewportId);
            return;
        }

        try {
            // Show loading state
            const emptyEl = document.getElementById(`viewport-empty-${targetViewportId.split('-')[1]}`);
            if (emptyEl) {
                emptyEl.innerHTML = `
                    <div class="empty-content">
                        <div class="spinner"></div>
                        <p>Loading series...</p>
                    </div>
                `;
            }

            // Get selected PACS node
            const pacsNode = document.getElementById('pacsNode')?.value || '';
            const params = pacsNode ? { pacsNode } : {};

            // Get instances for the series
            const response = await api.searchInstances(studyUid, seriesUid, params);
            const instances = Array.isArray(response) ? response : [];

            if (!instances || instances.length === 0) {
                showToast('Warning', 'No images found in series', 'warning');
                return;
            }

            // Sort by instance number
            instances.sort((a, b) => (a.instanceNumber || 0) - (b.instanceNumber || 0));

            // Build image IDs for WADO-URI
            const imageIds = instances.map(inst =>
                `wadouri:${api.getWadoUri(studyUid, seriesUid, inst.sopInstanceUid)}`
            );

            // Load stack into viewport
            await viewport.setStack(imageIds, 0);

            // Update overlays
            this.updateViewportOverlays(targetViewportId, studyUid, seriesUid, instances[0]);

            // Store mapping
            this.loadedSeries.set(seriesUid, targetViewportId);

            // Show cine controls for multi-frame
            if (instances.length > 1) {
                const cineControls = document.getElementById('cineControls');
                if (cineControls) {
                    cineControls.style.display = 'flex';
                }
            }

            // Load thumbnails
            this.loadThumbnails(studyUid, seriesUid, instances);

        } catch (error) {
            console.error('Error loading series:', error);
            showToast('Error', `Failed to load series: ${error.message}`, 'error');
        }
    }

    updateViewportOverlays(viewportId, studyUid, seriesUid, instance) {
        const idx = viewportId.split('-')[1];

        // Try to get study info from app state
        const study = window.appState?.currentStudy;

        if (study) {
            const patientEl = document.getElementById(`overlay-patient-${idx}`);
            if (patientEl) patientEl.textContent = study.patientName || 'Unknown';

            const studyEl = document.getElementById(`overlay-study-${idx}`);
            if (studyEl) studyEl.textContent = formatDicomDate(study.studyDate);
        }

        const modalityEl = document.getElementById(`overlay-modality-${idx}`);
        if (modalityEl && instance) {
            modalityEl.textContent = instance.modality || '';
        }
    }

    async loadThumbnails(studyUid, seriesUid, instances) {
        const grid = document.getElementById('thumbnailGrid');
        grid.innerHTML = '';

        for (let i = 0; i < instances.length; i++) {
            const inst = instances[i];
            const thumbDiv = document.createElement('div');
            thumbDiv.className = 'thumbnail-item';
            thumbDiv.dataset.index = i;

            thumbDiv.innerHTML = `
                <img src="" alt="Image ${i + 1}">
                <span class="label">${i + 1}</span>
            `;

            // Load thumbnail image
            try {
                const response = await api.getThumbnail(studyUid, seriesUid, inst.sopInstanceUid, 64);
                if (response.ok) {
                    const blob = await response.blob();
                    const img = thumbDiv.querySelector('img');
                    img.src = URL.createObjectURL(blob);
                }
            } catch (e) {
                // Thumbnail failed, show placeholder
            }

            // Click to jump to image
            thumbDiv.addEventListener('click', () => {
                const viewport = this.getActiveViewport();
                if (viewport && viewport.loadAndDisplayImage) {
                    viewport.loadAndDisplayImage(i);
                }
                // Update active thumbnail
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

    setLayout(rows, cols) {
        this.setupViewports(rows, cols);
    }

    setMPRLayout() {
        // MPR layout: main view + sagittal + coronal
        const grid = document.getElementById('viewportGrid');
        grid.className = 'viewport-grid layout-mpr';

        // For now, use 2x2 layout as MPR placeholder
        this.setupViewports(2, 2);
        showToast('Info', 'MPR mode - Full implementation in Phase 3', 'info');
    }

    resetViewport(viewportId = null) {
        const vp = viewportId ? this.viewports.get(viewportId) : this.getActiveViewport();
        if (vp && vp.reset) {
            vp.reset();
        }
    }

    setWindowLevel(center, width) {
        const vp = this.getActiveViewport();
        if (vp && vp.setWindowLevel) {
            vp.setWindowLevel(center, width);
        }
    }

    flipHorizontal() {
        const vp = this.getActiveViewport();
        if (vp && vp.flipHorizontal) {
            vp.flipHorizontal();
        }
    }

    flipVertical() {
        const vp = this.getActiveViewport();
        if (vp && vp.flipVertical) {
            vp.flipVertical();
        }
    }

    rotate(angle) {
        const vp = this.getActiveViewport();
        if (vp) {
            const current = vp.state?.rotation || 0;
            vp.setRotation((current + angle) % 360);
        }
    }

    invert() {
        const vp = this.getActiveViewport();
        if (vp && vp.invert) {
            vp.invert();
        }
    }
}

// Helper function
function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length !== 8) return dateStr || '';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

// Create global instance
const viewportManager = new ViewportManager();

