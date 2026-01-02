/**
 * Raster PACS Viewer - Main Application
 * Advanced Zero-Footprint DICOM Viewer with MPR and 3D Support
 */

// Initialize application
document.addEventListener('DOMContentLoaded', async () => {
    console.log('Raster PACS Viewer v2.0 initializing...');

    // Check server status
    await checkServerStatus();

    // Initialize viewport manager (uses advanced features if available)
    await viewportManager.initialize();

    // Initialize annotation manager
    annotationManager.initialize();

    // Load PACS nodes
    await loadPacsNodes();

    // Setup keyboard shortcuts
    setupKeyboardShortcuts();

    // Setup WebSocket for retrieve progress
    setupWebSocket();

    // Setup viewport event handlers
    setupViewportEvents();

    console.log('Raster PACS Viewer v2.0 ready');
});

/**
 * Check server status
 */
async function checkServerStatus() {
    const statusIndicator = document.getElementById('serverStatus');
    const statusText = document.getElementById('serverStatusText');

    try {
        const nodes = await api.getPacsNodes();
        statusIndicator.classList.remove('offline');
        statusText.textContent = 'Online';
        return true;
    } catch (error) {
        statusIndicator.classList.add('offline');
        statusText.textContent = 'Offline';
        showToast('Server connection failed', 'error');
        return false;
    }
}

/**
 * Setup viewport event handlers for overlay updates
 */
function setupViewportEvents() {
    // Update overlays on camera changes
    if (CornerstoneService?.isInitialized()) {
        const renderingEngine = CornerstoneService.getRenderingEngine();
        if (renderingEngine) {
            // Listen for image rendered events
            document.getElementById('viewportGrid')?.addEventListener('cornerstoneimagerendered', (e) => {
                updateViewportOverlaysFromEvent(e);
            });
        }
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
                const wc = (props.voiRange.upper + props.voiRange.lower) / 2;
                const ww = props.voiRange.upper - props.voiRange.lower;
                wlEl.textContent = `W: ${Math.round(ww)} L: ${Math.round(wc)}`;
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
 * Setup WebSocket for real-time updates
 */
function setupWebSocket() {
    // Check if SockJS is available
    if (typeof SockJS === 'undefined') {
        console.log('WebSocket: SockJS not available, using polling');
        return;
    }

    try {
        const socket = new SockJS(CONFIG.WS_ENDPOINT);
        const stompClient = Stomp.over(socket);

        stompClient.connect({}, (frame) => {
            console.log('WebSocket connected');

            // Subscribe to retrieve progress
            stompClient.subscribe('/topic/retrieve/*', (message) => {
                const progress = JSON.parse(message.body);
                updateRetrieveProgress(progress);
            });
        }, (error) => {
            console.log('WebSocket connection failed:', error);
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
            statusEl.textContent = `Retrieving: ${progress.completedInstances}/${progress.totalInstances} (${progress.percentComplete}%)`;
            statusEl.style.color = 'var(--warning)';
            break;
        case 'COMPLETED':
            statusEl.textContent = `Retrieved ${progress.totalInstances} images`;
            statusEl.style.color = 'var(--success)';
            setTimeout(() => { statusEl.textContent = ''; }, 5000);
            break;
        case 'FAILED':
            statusEl.textContent = 'Retrieve failed';
            statusEl.style.color = 'var(--error)';
            break;
        default:
            statusEl.textContent = progress.status;
    }
}

/**
 * Update memory usage display
 */
function updateMemoryUsage() {
    if (performance.memory) {
        const used = Math.round(performance.memory.usedJSHeapSize / (1024 * 1024));
        document.getElementById('memoryUsage').textContent = `Memory: ${used} MB`;
    }
}

// Update memory usage periodically
setInterval(updateMemoryUsage, 5000);

// Handle window resize
window.addEventListener('resize', () => {
    if (viewportManager.renderingEngine) {
        viewportManager.renderingEngine.resize();
    }
});

// Prevent context menu on viewports
document.getElementById('viewportGrid')?.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});

