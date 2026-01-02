/**
 * Raster PACS Pro - Main Application
 * Enhanced Zero-Footprint DICOM Viewer with Premium UX
 * Version 2.0
 */

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('🏥 Raster PACS Pro v2.0 initializing...');

    // Show loading state
    updateServerStatus('connecting');

    // Check server status
    const online = await checkServerStatus();

    // Initialize viewport manager
    try {
        await viewportManager.initialize();
        console.log('✅ Viewport manager initialized');
    } catch (e) {
        console.warn('⚠️ Viewport manager initialization warning:', e);
    }

    // Initialize annotation manager
    try {
        annotationManager.initialize();
        console.log('✅ Annotation manager initialized');
    } catch (e) {
        console.warn('⚠️ Annotation manager initialization warning:', e);
    }

    // Initialize 3D reconstruction module
    try {
        if (typeof reconstruction3D !== 'undefined') {
            await reconstruction3D.initialize();
            console.log('✅ 3D Reconstruction module initialized');
        }
    } catch (e) {
        console.warn('⚠️ 3D Reconstruction module initialization warning:', e);
    }

    // Initialize workflow manager
    try {
        if (typeof workflowManager !== 'undefined') {
            await workflowManager.initialize();
            console.log('✅ Workflow manager initialized');
        }
    } catch (e) {
        console.warn('⚠️ Workflow manager initialization warning:', e);
    }

    // Load PACS nodes
    await loadPacsNodes();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup WebSocket for real-time updates
    setupWebSocket();

    // Setup viewport event handlers
    setupViewportEvents();

    // Setup drag and drop
    setupDragAndDrop();

    // Start clock
    startClock();

    // Update memory usage periodically
    setInterval(updateMemoryUsage, 5000);

    console.log('✅ Raster PACS Pro v2.0 ready');

    if (online) {
        showToast('Ready', 'PACS Viewer is ready to use', 'success');
    }
});

/**
 * Check server status with enhanced UI feedback
 */
async function checkServerStatus() {
    try {
        const nodes = await api.getPacsNodes();
        updateServerStatus('online');
        return true;
    } catch (error) {
        updateServerStatus('offline');
        showToast('Connection Error', 'Unable to connect to PACS server', 'error');
        return false;
    }
}

/**
 * Update server status badge
 */
function updateServerStatus(status) {
    const badge = document.getElementById('serverStatusBadge');
    const text = document.getElementById('serverStatusText');

    badge.classList.remove('offline');

    switch (status) {
        case 'online':
            text.textContent = 'Online';
            break;
        case 'offline':
            badge.classList.add('offline');
            text.textContent = 'Offline';
            break;
        case 'connecting':
            text.textContent = 'Connecting...';
            break;
    }
}

/**
 * Setup keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (e) => {
        // Don't trigger shortcuts when typing in inputs
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
            return;
        }

        // Tool shortcuts
        switch (e.key.toLowerCase()) {
            case 'w':
                setTool('WindowLevel');
                break;
            case 'p':
                setTool('Pan');
                break;
            case 'z':
                setTool('Zoom');
                break;
            case 's':
                setTool('StackScroll');
                break;
            case 'l':
                setMeasureTool('length');
                break;
            case 'a':
                setMeasureTool('angle');
                break;
            case 'r':
                setMeasureTool('ellipse');
                break;
            case 'b':
                setSegTool('brush');
                break;
            case 'e':
                setSegTool('eraser');
                break;
            case 'f':
                setSegTool('fill');
                break;
            case 'i':
                invertColors();
                break;
            case 'escape':
                resetViewport();
                break;
            case 'tab':
                e.preventDefault();
                toggleSidebar();
                break;
            case '?':
                showKeyboardShortcuts();
                break;
        }

        // Layout shortcuts with Ctrl/Cmd
        if (e.ctrlKey || e.metaKey) {
            switch (e.key) {
                case '1':
                    e.preventDefault();
                    setLayout(1, 1);
                    break;
                case '2':
                    e.preventDefault();
                    setLayout(1, 2);
                    break;
                case '4':
                    e.preventDefault();
                    setLayout(2, 2);
                    break;
            }
        }
    });
}

/**
 * Setup viewport event handlers
 */
function setupViewportEvents() {
    const viewportGrid = document.getElementById('viewportGrid');
    if (!viewportGrid) return;

    // Mouse position and pixel value tracking
    viewportGrid.addEventListener('mousemove', (e) => {
        updateMousePosition(e);
    });

    // Scroll wheel for stack navigation
    viewportGrid.addEventListener('wheel', (e) => {
        // Let Cornerstone handle the wheel event for stack scrolling
    }, { passive: true });

    // Viewport click to activate
    viewportGrid.addEventListener('click', (e) => {
        const viewport = e.target.closest('.viewport');
        if (viewport) {
            const index = parseInt(viewport.id.split('-')[1]) || 0;
            setActiveViewport(index);
        }
    });

    // Listen for cornerstone image rendered events
    viewportGrid.addEventListener('cornerstoneimagerendered', (e) => {
        updateViewportOverlaysFromEvent(e);
    });
}

/**
 * Update mouse position display
 */
function updateMousePosition(event) {
    const posEl = document.getElementById('mousePosition');
    const valEl = document.getElementById('pixelValue');

    // Get position relative to viewport
    const viewport = event.target.closest('.viewport-element');
    if (!viewport) {
        posEl.textContent = 'X: - Y: -';
        valEl.textContent = 'HU: -';
        return;
    }

    const rect = viewport.getBoundingClientRect();
    const x = Math.round(event.clientX - rect.left);
    const y = Math.round(event.clientY - rect.top);

    posEl.textContent = `X: ${x} Y: ${y}`;

    // Get pixel value if available
    try {
        if (CornerstoneService?.isInitialized()) {
            const viewportId = viewport.id.replace('viewport-element-', 'viewport-');
            const csViewport = viewportManager.viewports.get(viewportId);
            if (csViewport && csViewport.getPixelData) {
                // This would need proper implementation based on Cornerstone3D API
                // For now, show placeholder
            }
        }
    } catch (e) {
        // Ignore errors
    }
}

/**
 * Setup drag and drop for series
 */
function setupDragAndDrop() {
    const viewportGrid = document.getElementById('viewportGrid');
    if (!viewportGrid) return;

    viewportGrid.addEventListener('dragover', (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';

        const viewport = e.target.closest('.viewport');
        if (viewport) {
            viewport.classList.add('drop-target');
        }
    });

    viewportGrid.addEventListener('dragleave', (e) => {
        const viewport = e.target.closest('.viewport');
        if (viewport) {
            viewport.classList.remove('drop-target');
        }
    });

    viewportGrid.addEventListener('drop', (e) => {
        e.preventDefault();

        document.querySelectorAll('.viewport').forEach(vp => vp.classList.remove('drop-target'));
        document.querySelectorAll('.series-item').forEach(si => si.classList.remove('dragging'));

        try {
            const jsonData = e.dataTransfer.getData('application/json');
            if (!jsonData || jsonData.trim() === '') {
                console.log('Drop: No JSON data in transfer');
                return;
            }

            const data = JSON.parse(jsonData);
            if (data.studyUid && data.seriesUid) {
                const viewport = e.target.closest('.viewport');
                if (viewport) {
                    const index = parseInt(viewport.id.split('-')[1]) || 0;
                    setActiveViewport(index);
                    loadSeriesInViewer(data.studyUid, data.seriesUid);
                }
            }
        } catch (err) {
            console.warn('Drop error (possibly not a series drop):', err.message);
        }
    });
}

/**
 * Setup WebSocket for real-time updates
 */
function setupWebSocket() {
    if (typeof SockJS === 'undefined') {
        console.log('WebSocket: SockJS not available');
        return;
    }

    try {
        const socket = new SockJS(CONFIG.WS_ENDPOINT);
        const stompClient = Stomp.over(socket);
        stompClient.debug = null; // Disable debug logging

        stompClient.connect({}, (frame) => {
            console.log('📡 WebSocket connected');

            // Subscribe to retrieve progress
            stompClient.subscribe('/topic/retrieve/*', (message) => {
                const progress = JSON.parse(message.body);
                updateRetrieveProgress(progress);
            });
        }, (error) => {
            console.log('WebSocket connection failed, using polling');
        });
    } catch (e) {
        console.log('WebSocket setup failed:', e);
    }
}

/**
 * Update retrieve progress in status bar
 */
function updateRetrieveProgress(progress) {
    const statusEl = document.getElementById('retrieveStatus');

    switch (progress.status) {
        case 'RETRIEVING':
            statusEl.innerHTML = `<span class="animate-pulse">📥 Retrieving: ${progress.completedInstances}/${progress.totalInstances} (${progress.percentComplete}%)</span>`;
            statusEl.style.color = 'var(--warning)';
            break;
        case 'COMPLETED':
            statusEl.innerHTML = `<span class="text-success">✅ Retrieved ${progress.totalInstances} images</span>`;
            setTimeout(() => { statusEl.innerHTML = ''; }, 5000);
            break;
        case 'FAILED':
            statusEl.innerHTML = `<span class="text-error">❌ Retrieve failed</span>`;
            break;
        default:
            statusEl.textContent = progress.status;
    }
}

/**
 * Update overlays from viewport events
 */
function updateViewportOverlaysFromEvent(event) {
    const viewportId = event.detail?.viewportId;
    if (!viewportId) return;

    const idx = viewportId.split('-')[1];
    const viewport = viewportManager.viewports.get(viewportId);

    if (viewport) {
        // Update W/L overlay
        const wlEl = document.getElementById(`overlay-wl-${idx}`);
        if (wlEl && viewport.getProperties) {
            const props = viewport.getProperties();
            if (props.voiRange) {
                const wc = Math.round((props.voiRange.upper + props.voiRange.lower) / 2);
                const ww = Math.round(props.voiRange.upper - props.voiRange.lower);
                wlEl.textContent = `W: ${ww} L: ${wc}`;
            }
        }

        // Update zoom overlay
        const zoomEl = document.getElementById(`overlay-zoom-${idx}`);
        if (zoomEl && viewport.getZoom) {
            const zoom = viewport.getZoom();
            zoomEl.textContent = `Zoom: ${Math.round(zoom * 100)}%`;
        }

        // Update slice overlay
        const sliceEl = document.getElementById(`overlay-slice-${idx}`);
        if (sliceEl && viewport.getCurrentImageIdIndex) {
            const currentIndex = viewport.getCurrentImageIdIndex();
            const totalImages = viewport.getImageIds?.()?.length || 0;
            sliceEl.textContent = `${currentIndex + 1}/${totalImages}`;
        }
    }
}

/**
 * Update memory usage display
 */
function updateMemoryUsage() {
    const el = document.getElementById('memoryUsage');
    if (!el) return;

    if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        el.textContent = `Memory: ${used} MB`;
    } else {
        el.textContent = 'Memory: N/A';
    }
}

/**
 * Start clock in status bar
 */
function startClock() {
    const el = document.getElementById('currentTime');
    if (!el) return;

    const updateTime = () => {
        const now = new Date();
        el.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    updateTime();
    setInterval(updateTime, 1000);
}

/**
 * Open report editor
 */
function openReportEditor() {
    if (typeof reportManager !== 'undefined') {
        reportManager.showReportEditor();
    } else {
        showToast('Error', 'Report manager not available', 'error');
    }
}

/**
 * Create new segment
 */
function createNewSegment() {
    document.getElementById('newSegmentModal').style.display = 'flex';
}

/**
 * Close new segment modal
 */
function closeNewSegmentModal() {
    document.getElementById('newSegmentModal').style.display = 'none';
}

/**
 * Confirm segment creation
 */
function confirmCreateSegment() {
    const label = document.getElementById('newSegmentLabel').value || 'Untitled';
    const category = document.getElementById('newSegmentCategory').value;
    const type = document.getElementById('newSegmentType').value;
    const color = document.getElementById('newSegmentColor').value;
    const opacity = parseFloat(document.getElementById('newSegmentOpacity').value);

    if (typeof segmentationManager !== 'undefined') {
        segmentationManager.createSegment({
            label,
            category,
            type,
            color,
            opacity
        });
    }

    closeNewSegmentModal();
    showToast('Segment Created', `Created segment: ${label}`, 'success');
}

/**
 * Show segment panel (right panel)
 */
function showSegmentPanel() {
    showPanel('segmentation');
}

/**
 * Set brush shape
 */
function setBrushShape(shape) {
    if (typeof segmentationManager !== 'undefined') {
        segmentationManager.setBrushShape(shape);
    }

    // Update UI
    document.querySelectorAll('.brush-shape .btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
}

/**
 * Export segmentation to DICOM SEG
 */
function exportSegToDicomSeg() {
    if (typeof segmentationManager !== 'undefined') {
        segmentationManager.exportToDicomSeg();
    }
}

/**
 * Export segmentation to PACS
 */
function exportSegToPacs() {
    if (typeof segmentationManager !== 'undefined') {
        segmentationManager.sendToPacs();
    }
}

/**
 * Handle annotation import
 */
function handleAnnotationImport(input) {
    const file = input.files[0];
    if (file && typeof annotationManager !== 'undefined') {
        annotationManager.importFromJSON(file);
    }
    input.value = '';
}

/**
 * Save annotations to DICOM SR
 */
function saveAnnotationsToSR() {
    if (typeof annotationManager !== 'undefined') {
        annotationManager.saveToStructuredReport();
    }
}

/**
 * Save annotations to SR and PACS
 */
function saveAnnotationsToSRAndPACS() {
    if (typeof annotationManager !== 'undefined') {
        annotationManager.saveToStructuredReport(true);
    }
}

/**
 * Clear all annotations
 */
function clearAnnotations() {
    if (typeof annotationManager !== 'undefined') {
        annotationManager.clearAll();
    }
}

// Handle window resize
window.addEventListener('resize', () => {
    if (viewportManager?.renderingEngine) {
        viewportManager.renderingEngine.resize();
    }
});

// Prevent context menu on viewports
document.getElementById('viewportGrid')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

// Export functions to global scope
window.openReportEditor = openReportEditor;
window.createNewSegment = createNewSegment;
window.closeNewSegmentModal = closeNewSegmentModal;
window.confirmCreateSegment = confirmCreateSegment;
window.showSegmentPanel = showSegmentPanel;
window.setBrushShape = setBrushShape;
window.exportSegToDicomSeg = exportSegToDicomSeg;
window.exportSegToPacs = exportSegToPacs;
window.handleAnnotationImport = handleAnnotationImport;
window.saveAnnotationsToSR = saveAnnotationsToSR;
window.saveAnnotationsToSRAndPACS = saveAnnotationsToSRAndPACS;
window.clearAnnotations = clearAnnotations;
window.checkServerStatus = checkServerStatus;

