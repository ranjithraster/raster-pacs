/**
 * Tools Manager
 * Handles viewer tools and interactions
 */

let activeTool = 'WindowLevel';
let cineRunning = false;
let cineInterval = null;
let cineSpeed = 15;

// Expose activeTool globally
window.activeTool = activeTool;

// 3D Rendering presets
const RENDERING_PRESETS = {
    'ct-bone': {
        name: 'CT Bone',
        colorTransfer: [
            { x: -1000, r: 0.3, g: 0.3, b: 0.3 },
            { x: 300, r: 0.9, g: 0.85, b: 0.8 },
            { x: 1500, r: 1.0, g: 1.0, b: 0.9 }
        ],
        opacityTransfer: [
            { x: -1000, y: 0 },
            { x: 200, y: 0 },
            { x: 300, y: 0.15 },
            { x: 1500, y: 0.85 }
        ]
    },
    'ct-soft': {
        name: 'CT Soft Tissue',
        colorTransfer: [
            { x: -1000, r: 0.0, g: 0.0, b: 0.0 },
            { x: -500, r: 0.55, g: 0.25, b: 0.15 },
            { x: 0, r: 0.88, g: 0.60, b: 0.29 },
            { x: 100, r: 0.95, g: 0.75, b: 0.50 }
        ],
        opacityTransfer: [
            { x: -1000, y: 0 },
            { x: -500, y: 0 },
            { x: -200, y: 0.15 },
            { x: 100, y: 0.3 }
        ]
    },
    'ct-lung': {
        name: 'CT Lung',
        colorTransfer: [
            { x: -1000, r: 0.2, g: 0.1, b: 0.1 },
            { x: -600, r: 0.25, g: 0.25, b: 0.25 },
            { x: -400, r: 0.45, g: 0.45, b: 0.45 }
        ],
        opacityTransfer: [
            { x: -1000, y: 0 },
            { x: -900, y: 0.02 },
            { x: -600, y: 0.15 },
            { x: -400, y: 0 }
        ]
    },
    'ct-vascular': {
        name: 'CT Vascular',
        colorTransfer: [
            { x: -1000, r: 0.0, g: 0.0, b: 0.0 },
            { x: 100, r: 0.5, g: 0.0, b: 0.0 },
            { x: 200, r: 0.9, g: 0.1, b: 0.1 },
            { x: 400, r: 1.0, g: 0.5, b: 0.4 }
        ],
        opacityTransfer: [
            { x: -1000, y: 0 },
            { x: 100, y: 0 },
            { x: 200, y: 0.25 },
            { x: 400, y: 0.5 }
        ]
    },
    'mip': {
        name: 'Maximum Intensity Projection',
        preset: 'MIP'
    },
    'minip': {
        name: 'Minimum Intensity Projection',
        preset: 'MINIP'
    }
};

// Tool name mapping (UI name -> Cornerstone tool name)
const TOOL_NAME_MAP = {
    'WindowLevel': 'WindowLevel',
    'Pan': 'Pan',
    'Zoom': 'Zoom',
    'StackScroll': 'StackScrollMouseWheel',
    'Length': 'Length',
    'Angle': 'Angle',
    'EllipticalROI': 'EllipticalROI',
    'RectangleROI': 'RectangleROI',
    'CircleROI': 'CircleROI',
    'ArrowAnnotate': 'ArrowAnnotate',
    'Bidirectional': 'Bidirectional',
    'Probe': 'Probe'
};

// Fallback tool name mapping (UI name -> fallback viewport tool name)
const FALLBACK_TOOL_MAP = {
    'WindowLevel': 'windowlevel',
    'Pan': 'pan',
    'Zoom': 'zoom',
    'StackScroll': 'scroll',
    'Length': 'length',
    'Angle': 'angle',
    'EllipticalROI': 'roi'
};

/**
 * Set active tool
 */
function setTool(toolName) {
    activeTool = toolName;
    window.activeTool = toolName; // Keep window object in sync

    // Clear measurement tool when switching to regular tools
    if (window.measurementManager && window.measurementManager.activeTool) {
        window.measurementManager.setTool(null);
    }

    // Update button states
    document.querySelectorAll('.tool-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    // Map to fallback tool name
    const fallbackToolName = FALLBACK_TOOL_MAP[toolName] || toolName.toLowerCase();

    // Map to Cornerstone tool name
    const cornerstoneToolName = TOOL_NAME_MAP[toolName] || toolName;

    // Get the correct tool group ID from the viewport manager
    let toolGroupId = 'toolGroup-stack';
    if (typeof viewportManager !== 'undefined' && viewportManager) {
        if (viewportManager.toolGroups && viewportManager.layout) {
            const layoutType = viewportManager.layout.type || 'stack';
            toolGroupId = viewportManager.toolGroups.get(layoutType) || `toolGroup-${layoutType}`;
        }
    }

    // Try CornerstoneService first (for non-fallback mode)
    if (window.CornerstoneService && typeof window.CornerstoneService.setActiveTool === 'function') {
        try {
            window.CornerstoneService.setActiveTool(toolGroupId, cornerstoneToolName);
            console.log('Active tool set via CornerstoneService:', cornerstoneToolName, 'on group:', toolGroupId);
        } catch (e) {
            console.warn('CornerstoneService.setActiveTool failed:', e);
        }
    }

    // ALWAYS try to set on viewports (they may be FallbackViewport instances)
    if (typeof viewportManager !== 'undefined' && viewportManager && viewportManager.viewports) {
        let count = 0;
        viewportManager.viewports.forEach((vp, id) => {
            if (vp && typeof vp.setActiveTool === 'function') {
                vp.setActiveTool(fallbackToolName);
                count++;
            }
        });
        if (count > 0) {
            console.log('Set tool on', count, 'viewport(s):', fallbackToolName);
        }
    }

    // Also update MPR viewer if active
    if (typeof mprViewer !== 'undefined' && mprViewer && typeof mprViewer.setActiveTool === 'function') {
        mprViewer.setActiveTool(fallbackToolName);
    }

    console.log('Active tool:', toolName, '-> Fallback:', fallbackToolName, '-> Cornerstone:', cornerstoneToolName);
}

/**
 * Reset viewport
 */
function resetViewport() {
    viewportManager.resetViewport();
    // Reset sliders
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) {
        zoomSlider.value = 100;
        document.getElementById('zoomValue').textContent = '100%';
    }
}

/**
 * Apply zoom from slider
 */
function applyZoom(value) {
    const zoom = value / 100;
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.zoom = zoom;
        if (viewport.render) viewport.render();
    }
    const zoomValueEl = document.getElementById('zoomValue');
    if (zoomValueEl) {
        zoomValueEl.textContent = `${value}%`;
    }
}

/**
 * Set measurement tool
 */
function setMeasureTool(toolName) {
    // Deactivate viewport navigation tools
    activeTool = null;
    window.activeTool = null;

    // Update button states - handle both lowercase and original case
    document.querySelectorAll('.tool-btn').forEach(btn => {
        const btnTool = btn.dataset.tool?.toLowerCase();
        btn.classList.toggle('active', btnTool === toolName.toLowerCase());
    });

    // Initialize measurement manager if needed
    if (window.measurementManager) {
        // Get active viewport element
        const viewport = viewportManager?.getActiveViewport();
        const viewportId = viewportManager?.activeViewportId || 0;
        const viewportIndex = typeof viewportId === 'number' ? viewportId : (parseInt(viewportId.toString().split('-')[1]) || 0);
        const element = document.getElementById(`viewport-element-${viewportIndex}`);

        if (element) {
            // Re-initialize if viewport element changed or not yet initialized
            if (!window.measurementManager.canvas || window.measurementManager.viewportElement !== element) {
                window.measurementManager.initialize(element);
            }
            window.measurementManager.setTool(toolName);
            console.log('Measurement tool set:', toolName);
        } else {
            console.warn('No viewport element found for measurements');
        }
    } else {
        console.warn('MeasurementManager not available');
    }
}

/**
 * Clear all measurements
 */
function clearMeasurements() {
    if (window.measurementManager) {
        if (confirm('Clear all measurements?')) {
            window.measurementManager.clearAll();
            showToast('Cleared', 'All measurements removed', 'info');
        }
    }
}

/**
 * Export measurements
 */
function exportMeasurements() {
    if (window.measurementManager) {
        const data = window.measurementManager.exportMeasurements();
        const blob = new Blob([data], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `measurements-${new Date().toISOString().slice(0,10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Exported', 'Measurements exported to file', 'success');
    }
}

/**
 * Import measurements
 */
function importMeasurements(file) {
    if (!window.measurementManager) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const success = window.measurementManager.importMeasurements(e.target.result);
        if (success) {
            showToast('Imported', 'Measurements imported successfully', 'success');
        } else {
            showToast('Error', 'Failed to import measurements', 'error');
        }
    };
    reader.readAsText(file);
}

/**
 * Set calibration for measurements
 */
function setCalibration() {
    const factor = prompt('Enter calibration factor (1.0 = no adjustment):', '1.0');
    if (factor && !isNaN(parseFloat(factor))) {
        window.measurementManager?.setCalibration(parseFloat(factor));
        showToast('Calibrated', `Calibration set to ${factor}`, 'info');
    }
}

/**
 * Get measurements summary for report
 */
function getMeasurementsSummary() {
    return window.measurementManager?.getMeasurementsSummary() || { count: 0 };
}

/**
 * Reset zoom to 100%
 */
function resetZoom() {
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.zoom = 1;
        if (viewport.render) viewport.render();
    }
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) {
        zoomSlider.value = 100;
        document.getElementById('zoomValue').textContent = '100%';
    }
}

/**
 * Reset pan to center
 */
function resetPan() {
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.panX = 0;
        viewport.state.panY = 0;
        if (viewport.render) viewport.render();
    }
    showToast('Pan reset', 'info');
}

/**
 * Fit image to window
 */
function fitToWindow() {
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.zoom = 1;
        viewport.state.panX = 0;
        viewport.state.panY = 0;
        if (viewport.render) viewport.render();
    }
    const zoomSlider = document.getElementById('zoomSlider');
    if (zoomSlider) {
        zoomSlider.value = 100;
        document.getElementById('zoomValue').textContent = '100%';
    }
}

/**
 * Apply window width from slider
 */
function applyWindowWidth(value) {
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.windowWidth = parseInt(value);
        if (viewport.loadAndDisplayImage) {
            viewport.loadAndDisplayImage(viewport.currentImageIndex);
        }
    }
}

/**
 * Apply window center from slider
 */
function applyWindowCenter(value) {
    const viewport = viewportManager.getActiveViewport();
    if (viewport && viewport.state) {
        viewport.state.windowCenter = parseInt(value);
        if (viewport.loadAndDisplayImage) {
            viewport.loadAndDisplayImage(viewport.currentImageIndex);
        }
    }
}

/**
 * Flip horizontal
 */
function flipHorizontal() {
    viewportManager.flipHorizontal();
}

/**
 * Flip vertical
 */
function flipVertical() {
    viewportManager.flipVertical();
}

/**
 * Rotate viewport
 */
function rotate(angle) {
    viewportManager.rotate(angle);
}

/**
 * Invert colors
 */
function invertColors() {
    viewportManager.invert();
}

/**
 * Apply W/L preset
 */
function applyWLPreset(presetName) {
    if (!presetName) {
        // Reset to auto
        viewportManager.setWindowLevel(null, null);
        return;
    }

    const preset = CONFIG.WL_PRESETS[presetName];
    if (preset) {
        viewportManager.setWindowLevel(preset.center, preset.width);
    }
}

/**
 * Set layout
 */
function setLayout(rows, cols) {
    viewportManager.setLayout(rows, cols);

    // Update button states (support both old and new toolbar)
    document.querySelectorAll('.layout-btn, .layout-tile, .special-layout-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.layout === `${rows}x${cols}`) {
            btn.classList.add('active');
        }
    });

    // Hide MPR and 3D controls
    const mprControls = document.getElementById('mprControls');
    const renderingControls = document.getElementById('renderingControls');
    if (mprControls) mprControls.style.display = 'none';
    if (renderingControls) renderingControls.style.display = 'none';
}

/**
 * Set MPR layout
 */
function setMPRLayout() {
    viewportManager.setMPRLayout();

    // Update button states
    document.querySelectorAll('.layout-btn, .layout-tile, .special-layout-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.layout === 'mpr') {
            btn.classList.add('active');
        }
    });

    // Show MPR controls, hide 3D controls
    const mprControls = document.getElementById('mprControls');
    const renderingControls = document.getElementById('renderingControls');
    if (mprControls) mprControls.style.display = 'flex';
    if (renderingControls) renderingControls.style.display = 'none';
}

/**
 * Set 3D layout
 */
function set3DLayout() {
    console.log('set3DLayout called');

    // Use the advanced 3D reconstruction module if available
    if (typeof reconstruction3D !== 'undefined') {
        console.log('reconstruction3D module found');

        reconstruction3D.initialize().then(async () => {
            console.log('reconstruction3D initialized, setting up layout');
            reconstruction3D.setup3DLayout();

            const studyUid = window.appState?.currentStudy?.studyInstanceUid;
            if (!studyUid) {
                console.warn('Missing studyUid');
                showToast('Error', 'No study selected', 'warning');
                return;
            }

            // Try to get the current series from appState first (most recently selected)
            let seriesUid = window.appState?.currentSeries?.seriesInstanceUid;
            console.log('Current series from appState:', seriesUid);
            console.log('appState.currentSeries:', window.appState?.currentSeries);

            // If we have series loaded in appState, find the one with most images
            if (!seriesUid && window.appState?.series && window.appState.series.length > 0) {
                console.log('Looking for best series in appState.series...');
                let bestSeries = null;
                let maxImages = 0;

                for (const s of window.appState.series) {
                    const count = parseInt(s.numberOfSeriesRelatedInstances) || 0;
                    console.log(`Series ${s.seriesInstanceUid}: ${count} images`);
                    if (count > maxImages) {
                        maxImages = count;
                        bestSeries = s;
                    }
                }

                if (bestSeries) {
                    seriesUid = bestSeries.seriesInstanceUid;
                    console.log('Selected best series:', seriesUid, 'with', maxImages, 'images');
                }
            }

            // If still no series, try viewportManager.loadedSeries
            if (!seriesUid && viewportManager.loadedSeries && viewportManager.loadedSeries.size > 0) {
                const seriesUids = Array.from(viewportManager.loadedSeries.keys());
                console.log('Checking viewportManager.loadedSeries:', seriesUids);

                // Just take the last one (most recently loaded)
                seriesUid = seriesUids[seriesUids.length - 1];
                console.log('Using last loaded series:', seriesUid);
            }

            if (!seriesUid) {
                console.warn('No series found');
                showToast('No Series Loaded', 'Please load a CT/MR series first, then switch to 3D', 'info');
                return;
            }

            // Fetch instances for the selected series
            console.log('Loading series for 3D:', seriesUid);
            try {
                const pacsNode = document.getElementById('pacsNode')?.value || '';
                const params = pacsNode ? { pacsNode } : {};
                let instances = await api.searchInstances(studyUid, seriesUid, params);
                instances = Array.isArray(instances) ? instances : [];
                console.log('Fetched', instances.length, 'instances for 3D');

                if (instances.length < 3) {
                    showToast('Not Enough Images', `Series has only ${instances.length} image(s). 3D requires at least 3 images.`, 'warning');
                    return;
                }

                // Sort by instance number
                instances.sort((a, b) => (a.instanceNumber || 0) - (b.instanceNumber || 0));

                const imageIds = instances.map(inst =>
                    `wadouri:${api.getWadoUri(studyUid, seriesUid, inst.sopInstanceUid)}`
                );

                console.log('Loading 3D volume with', imageIds.length, 'images');
                reconstruction3D.loadVolume(studyUid, seriesUid, imageIds);

            } catch (e) {
                console.error('Failed to fetch instances:', e);
                showToast('Error', 'Failed to fetch series instances', 'error');
            }
        }).catch(err => {
            console.error('Error initializing 3D:', err);
        });
    } else {
        console.warn('reconstruction3D module not found');
        // Fallback to basic 3D layout
        if (viewportManager.useFallback) {
            showToast('3D rendering requires WebGL support', 'warning');
            return;
        }
        viewportManager.setLayout(1, 1, '3d');
    }

    // Update button states
    document.querySelectorAll('.layout-btn, .layout-tile, .special-layout-btn').forEach(btn => {
        btn.classList.remove('active');
        if (btn.dataset.layout === '3d') {
            btn.classList.add('active');
        }
    });

    // Show 3D controls, hide MPR controls
    const mprControls = document.getElementById('mprControls');
    const renderingControls = document.getElementById('renderingControls');
    if (mprControls) mprControls.style.display = 'none';
    if (renderingControls) renderingControls.style.display = 'flex';
}

/**
 * Apply 3D rendering preset
 */
function apply3DPreset(presetName) {
    // Use the advanced 3D reconstruction module if available
    if (typeof reconstruction3D !== 'undefined' && reconstruction3D.isInitialized) {
        reconstruction3D.applyPreset(presetName);
        return;
    }

    // Fallback to basic preset application
    const preset = RENDERING_PRESETS[presetName];
    if (!preset) return;

    const viewport = viewportManager.getActiveViewport();
    if (!viewport) return;

    // Apply preset based on type
    if (preset.preset === 'MIP' || preset.preset === 'MINIP') {
        // Set blend mode for MIP/MinIP
        viewport.setBlendMode && viewport.setBlendMode(
            preset.preset === 'MIP' ? 'MAXIMUM_INTENSITY_BLEND' : 'MINIMUM_INTENSITY_BLEND'
        );
    } else {
        // Apply custom transfer functions for volume rendering
        if (viewport.setProperties) {
            viewport.setProperties({
                // These would be applied if using VTK.js volume rendering
            });
        }
    }

    viewport.render && viewport.render();
    showToast(`Applied ${preset.name} preset`, 'info');
}

/**
 * Set 3D opacity
 */
function set3DOpacity(value) {
    const viewport = viewportManager.getActiveViewport();
    if (!viewport || !viewport.setProperties) return;

    viewport.setProperties({
        opacity: value / 100
    });
    viewport.render && viewport.render();
}

/**
 * Save annotations to DICOM SR (local only)
 */
async function saveAnnotationsToSR() {
    try {
        await annotationManager.saveAsDicomSR(false);
    } catch (error) {
        console.error('Error saving annotations:', error);
    }
}

/**
 * Save annotations to DICOM SR and store to PACS
 */
async function saveAnnotationsToSRAndPACS() {
    const pacsNode = document.getElementById('pacsNode')?.value || null;

    try {
        await annotationManager.saveAsDicomSR(true, pacsNode);
    } catch (error) {
        console.error('Error saving annotations to PACS:', error);
    }
}

/**
 * Handle annotation file import
 */
function handleAnnotationImport(input) {
    if (input.files && input.files[0]) {
        annotationManager.importFromJSON(input.files[0]);
        input.value = ''; // Reset for next import
    }
}

/**
 * Clear annotations with confirmation
 */
function clearAnnotations() {
    if (annotationManager.annotations.size === 0) {
        showToast('No annotations to clear', 'info');
        return;
    }

    if (confirm('Are you sure you want to clear all annotations?')) {
        annotationManager.clearAllAnnotations();
        showToast('Annotations cleared', 'info');
    }
}

/**
 * Cine play/pause
 */
function cinePlay() {
    // Use MPR viewer's cine controller if available
    if (typeof mprViewer !== 'undefined' && mprViewer.cineController) {
        mprViewer.cineController.toggle();
        return;
    }

    const btn = document.getElementById('cinePlayBtn');

    if (cineRunning) {
        // Stop
        clearInterval(cineInterval);
        cineRunning = false;
        btn.textContent = '▶';
    } else {
        // Start
        cineRunning = true;
        btn.textContent = '⏸';

        cineInterval = setInterval(() => {
            const vp = viewportManager.getActiveViewport();
            if (vp) {
                if (typeof vp.scroll === 'function') {
                    vp.scroll(1);
                } else if (vp.currentImageIndex !== undefined && vp.imageStack) {
                    if (vp.currentImageIndex < vp.imageStack.length - 1) {
                        vp.nextImage();
                    } else {
                        vp.loadAndDisplayImage(0); // Loop
                    }
                }
            }
        }, 1000 / cineSpeed);
    }
}

/**
 * Set cine speed
 */
function setCineSpeed(fps) {
    cineSpeed = parseInt(fps);
    document.getElementById('cineSpeedLabel').textContent = `${cineSpeed} fps`;

    // Use MPR viewer's cine controller if available
    if (typeof mprViewer !== 'undefined' && mprViewer.cineController) {
        mprViewer.cineController.setFPS(cineSpeed);
        return;
    }

    // Restart if running
    if (cineRunning) {
        clearInterval(cineInterval);
        cinePlay();
        cinePlay(); // Toggle twice to restart with new speed
    }
}

/**
 * Set cine loop mode
 */
function setCineLoopMode(mode) {
    // Use MPR viewer's cine controller if available
    if (typeof mprViewer !== 'undefined' && mprViewer.cineController) {
        mprViewer.cineController.setLoopMode(mode);
    }
}

/**
 * Show panel in right sidebar
 */
function showPanel(panelName) {
    // Hide all panels
    document.querySelectorAll('.panel-content').forEach(p => p.style.display = 'none');

    // Show selected panel
    document.getElementById(`${panelName}Panel`).style.display = 'block';

    // Update tab states
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.panel === panelName);
    });
}


/**
 * Toast notification
 * @param {string} title - Title of the toast
 * @param {string} message - Optional message body
 * @param {string} type - Type: 'info', 'success', 'warning', 'error'
 */
function showToast(title, message = '', type = 'info') {
    const container = document.getElementById('toastContainer');
    if (!container) return;

    const icons = {
        success: '✅',
        error: '❌',
        warning: '⚠️',
        info: 'ℹ️'
    };

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <span class="toast-icon">${icons[type] || icons.info}</span>
        <div class="toast-content">
            <div class="toast-title">${title}</div>
            ${message ? `<div class="toast-message">${message}</div>` : ''}
        </div>
        <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
    `;

    container.appendChild(toast);

    // Auto remove after 5 seconds
    setTimeout(() => {
        if (toast.parentElement) {
            toast.style.animation = 'toastSlideIn 0.3s ease reverse';
            setTimeout(() => toast.remove(), 300);
        }
    }, 5000);
}

/**
 * Keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger if in input
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;

        switch (e.key.toLowerCase()) {
            case 'w':
                setTool('WindowLevel');
                break;
            case 'z':
                setTool('Zoom');
                break;
            case 'p':
                setTool('Pan');
                break;
            case 's':
                setTool('StackScroll');
                break;
            case 'l':
                setTool('Length');
                break;
            case 'r':
                resetViewport();
                break;
            case 'i':
                invertColors();
                break;
            case ' ':
                e.preventDefault();
                cinePlay();
                break;
            case 'arrowup':
            case 'arrowleft':
                e.preventDefault();
                viewportManager.getActiveViewport()?.previousImage();
                break;
            case 'arrowdown':
            case 'arrowright':
                e.preventDefault();
                viewportManager.getActiveViewport()?.nextImage();
                break;
            // Segmentation shortcuts
            case 'b':
                setSegTool('brush');
                break;
            case 'e':
                setSegTool('eraser');
                break;
            case 'f':
                setSegTool('fill');
                break;
            case 'u':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    segmentationManager.undo();
                }
                break;
            case 'y':
                if (e.ctrlKey || e.metaKey) {
                    e.preventDefault();
                    segmentationManager.redo();
                }
                break;
        }
    });
}

// ==================== Segmentation Functions ====================

/**
 * Set segmentation tool
 */
function setSegTool(toolName) {
    // Deactivate other viewer tools
    activeTool = null;
    document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));

    // Activate segmentation tool (support both old and new classes)
    document.querySelectorAll('.seg-tool-btn, .seg-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.tool === toolName);
    });

    segmentationManager.setTool(toolName);
}

/**
 * Set brush shape
 */
function setBrushShape(shape) {
    segmentationManager.setBrushShape(shape);

    // Update button states
    document.querySelectorAll('.brush-shape .btn').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.toLowerCase().includes(shape));
    });
}

/**
 * Show segments panel
 */
function showSegmentPanel() {
    showPanel('segmentation');
}

/**
 * Create new segment
 */
function createNewSegment() {
    document.getElementById('newSegmentModal').style.display = 'flex';
    document.getElementById('newSegmentLabel').value = `Segment ${segmentationManager.segments.size + 1}`;
    document.getElementById('newSegmentColor').value = segmentationManager.getNextColor();
}

/**
 * Close new segment modal
 */
function closeNewSegmentModal() {
    document.getElementById('newSegmentModal').style.display = 'none';
}

/**
 * Confirm create segment
 */
function confirmCreateSegment() {
    const label = document.getElementById('newSegmentLabel').value || 'Segment';
    const category = document.getElementById('newSegmentCategory').value;
    const type = document.getElementById('newSegmentType').value;
    const color = document.getElementById('newSegmentColor').value;
    const opacity = parseFloat(document.getElementById('newSegmentOpacity').value);

    segmentationManager.createSegment({
        label: label,
        category: category,
        type: type,
        color: color,
        opacity: opacity
    });

    closeNewSegmentModal();
    showToast(`Created segment: ${label}`, 'success');
}

/**
 * Export segmentation to DICOM SEG
 */
async function exportSegToDicomSeg() {
    await segmentationManager.exportToDicomSeg(null);
}

/**
 * Export segmentation to PACS
 */
async function exportSegToPacs() {
    const pacsNode = document.getElementById('pacsNode')?.value || null;
    await segmentationManager.exportToDicomSeg(pacsNode);
}

// ==================== Report Functions ====================

/**
 * Open report editor for current study
 */
function openReportEditor() {
    const currentStudy = viewportManager.currentStudy;
    if (!currentStudy) {
        showToast('Please load a study first', 'warning');
        return;
    }

    reportManager.openForStudy(currentStudy.studyInstanceUid, {
        studyInstanceUid: currentStudy.studyInstanceUid,
        patientId: currentStudy.patientId,
        patientName: currentStudy.patientName,
        accessionNumber: currentStudy.accessionNumber,
        studyDate: currentStudy.studyDate,
        referringPhysician: currentStudy.referringPhysician,
        modality: currentStudy.modality
    });
}

/**
 * Add current image as key image to report
 */
function addKeyImageToReport() {
    const viewport = viewportManager.getActiveViewport();
    if (!viewport) {
        showToast('No active viewport', 'warning');
        return;
    }

    const imageId = viewport.getCurrentImageId?.();
    if (!imageId) {
        showToast('No image loaded', 'warning');
        return;
    }

    // Extract SOP Instance UID from image ID
    const sopInstanceUid = imageId.split('/').pop()?.split('?')[0];
    const seriesInstanceUid = viewportManager.currentSeriesUid;

    const description = prompt('Enter description for key image:', 'Key Image');
    if (description !== null) {
        reportManager.insertKeyImage(sopInstanceUid, seriesInstanceUid, description);
    }
}

/**
 * Add measurement to report
 */
function addMeasurementToReport(measurement) {
    if (!reportManager.currentReport) {
        showToast('Please open a report first', 'warning');
        return;
    }

    reportManager.insertMeasurement(measurement);
}

