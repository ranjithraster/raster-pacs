/**
 * Raster PACS Pro - Study Browser
 * Enhanced study search and selection with modern UX
 */

// App state
window.appState = {
    currentStudy: null,
    currentSeries: null,
    studies: [],
    series: [],
    selectedViewport: 0
};

/**
 * Search studies from PACS with enhanced UI feedback
 */
async function searchStudies() {
    const loading = document.getElementById('searchLoading');
    const studyList = document.getElementById('studyList');
    const studyListHeader = document.getElementById('studyListHeader');

    // Show loading state
    loading.classList.add('show');
    studyList.innerHTML = '';
    studyListHeader.style.display = 'none';

    // Build query parameters
    const params = {};

    const patientId = document.getElementById('patientId').value.trim();
    const patientName = document.getElementById('patientName').value.trim();
    const dateFrom = document.getElementById('studyDateFrom').value;
    const dateTo = document.getElementById('studyDateTo').value;
    const modalitySelect = document.getElementById('modality');
    const selectedModalities = Array.from(modalitySelect.selectedOptions).map(opt => opt.value).filter(v => v);
    const modality = selectedModalities.join('\\');
    const accessionNumber = document.getElementById('accessionNumber').value.trim();
    const pacsNode = document.getElementById('pacsNode').value;

    if (patientId) params.PatientID = patientId;
    if (patientName) params.PatientName = patientName + '*';
    if (dateFrom && dateTo) {
        params.StudyDate = dateFrom.replace(/-/g, '') + '-' + dateTo.replace(/-/g, '');
    } else if (dateFrom) {
        params.StudyDate = dateFrom.replace(/-/g, '') + '-';
    } else if (dateTo) {
        params.StudyDate = '-' + dateTo.replace(/-/g, '');
    }
    if (modality) params.ModalitiesInStudy = modality;
    if (accessionNumber) params.AccessionNumber = accessionNumber;
    if (pacsNode) params.pacsNode = pacsNode;

    try {
        const response = await api.searchStudies(params);
        // Ensure studies is always an array
        const studies = Array.isArray(response) ? response : [];
        window.appState.studies = studies;

        if (studies.length === 0) {
            studyList.innerHTML = `
                <div class="empty-state animate-fadeIn">
                    <div class="icon">📭</div>
                    <h4>No Studies Found</h4>
                    <p>Try adjusting your search criteria</p>
                </div>
            `;
        } else {
            displayStudies(studies);
            if (studyListHeader) studyListHeader.style.display = 'flex';
            const studyCountEl = document.getElementById('studyCountNum');
            if (studyCountEl) studyCountEl.textContent = studies.length;
        }

        showToast('Search Complete', `Found ${studies.length} studies`, 'success');

    } catch (error) {
        console.error('Search error:', error);
        studyList.innerHTML = `
            <div class="empty-state animate-fadeIn">
                <div class="icon">⚠️</div>
                <h4>Search Failed</h4>
                <p>${error.message || 'Unable to connect to PACS server'}</p>
            </div>
        `;
        showToast('Search Error', error.message, 'error');
    } finally {
        loading.classList.remove('show');
    }
}

/**
 * Display studies with enhanced card UI
 */
function displayStudies(studies) {
    const studyList = document.getElementById('studyList');

    studyList.innerHTML = studies.map((study, index) => `
        <div class="study-card animate-slideUp" 
             style="animation-delay: ${index * 0.05}s"
             onclick="selectStudy('${study.studyInstanceUid}')" 
             data-uid="${study.studyInstanceUid}">
            <div class="study-card-header">
                <div class="patient-info">
                    <div class="patient-name">${escapeHtml(study.patientName) || 'Unknown Patient'}</div>
                    <div class="patient-id">ID: ${study.patientId || 'N/A'}</div>
                </div>
                <span class="modality-badge">${study.modalitiesInStudy || '?'}</span>
            </div>
            <div class="study-card-body">
                <div class="study-description">${escapeHtml(study.studyDescription) || 'No description'}</div>
            </div>
            <div class="study-card-footer">
                <div class="study-meta">
                    <span><span class="icon">📅</span> ${formatDicomDate(study.studyDate)}</span>
                    <span><span class="icon">📂</span> ${study.numberOfStudyRelatedSeries || 0} series</span>
                    <span><span class="icon">🖼️</span> ${study.numberOfStudyRelatedInstances || 0} images</span>
                </div>
                <div class="study-actions">
                    <button class="btn-icon" onclick="event.stopPropagation(); quickLoadStudy('${study.studyInstanceUid}')" title="Quick Load">
                        ⚡
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

/**
 * Select a study and load its series with enhanced animations
 */
async function selectStudy(studyUid) {
    console.log('[StudyBrowser] selectStudy called with:', studyUid);

    // Update selection visual
    document.querySelectorAll('.study-card').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.querySelector(`.study-card[data-uid="${studyUid}"]`);
    if (selectedEl) selectedEl.classList.add('selected');

    // Find study data
    const study = window.appState.studies.find(s => s.studyInstanceUid === studyUid);
    console.log('[StudyBrowser] Found study:', study);
    window.appState.currentStudy = study;

    // Update header display
    updateHeaderStudyInfo(study);

    // Show series panel
    const seriesPanel = document.getElementById('seriesPanel');
    seriesPanel.classList.add('show');

    const seriesList = document.getElementById('seriesList');
    seriesList.innerHTML = `
        <div class="loading-container show">
            <div class="loading-spinner"></div>
            <span class="loading-text">Loading series...</span>
        </div>
    `;

    try {
        // Get selected PACS node
        const pacsNode = document.getElementById('pacsNode')?.value || '';
        const params = pacsNode ? { pacsNode } : {};
        console.log('[StudyBrowser] Searching series with params:', params);

        const response = await api.searchSeries(studyUid, params);
        console.log('[StudyBrowser] Series response:', response);
        // Ensure series is always an array
        const series = Array.isArray(response) ? response : [];
        console.log('[StudyBrowser] Found', series.length, 'series');
        window.appState.series = series;

        if (series.length === 0) {
            console.warn('[StudyBrowser] No series found');
            seriesList.innerHTML = `
                <div class="empty-state">
                    <p class="text-muted">No series found</p>
                </div>
            `;
            return;
        }

        displaySeries(studyUid, series);
        updateInfoPanel(study, series[0]);

        // Auto-load first series into viewer
        console.log('[StudyBrowser] Auto-loading first series:', series[0].seriesInstanceUid);
        loadSeriesInViewer(studyUid, series[0].seriesInstanceUid);

    } catch (error) {
        console.error('Error loading series:', error);
        seriesList.innerHTML = `
            <div class="empty-state">
                <div class="icon">⚠️</div>
                <p class="text-error">Failed to load series</p>
            </div>
        `;
        showToast('Error', 'Failed to load series', 'error');
    }
}

/**
 * Update header with current study info
 */
function updateHeaderStudyInfo(study) {
    const patientNameEl = document.getElementById('headerPatientName');
    const studyDateEl = document.getElementById('headerStudyDate');
    const modalityEl = document.getElementById('headerModality');

    if (study) {
        if (patientNameEl) patientNameEl.textContent = study.patientName || 'Unknown';
        if (studyDateEl) studyDateEl.textContent = formatDicomDate(study.studyDate);
        if (modalityEl) modalityEl.textContent = study.modalitiesInStudy || '-';
    } else {
        if (patientNameEl) patientNameEl.textContent = 'No Study Loaded';
        if (studyDateEl) studyDateEl.textContent = '-';
        if (modalityEl) modalityEl.textContent = '-';
    }
}

/**
 * Display series with enhanced thumbnails
 */
function displaySeries(studyUid, series) {
    const seriesList = document.getElementById('seriesList');

    seriesList.innerHTML = series.map((s, index) => {
        const is3D = is3DCompatibleSeries(s);
        const quality3D = is3D ? get3DQuality(s) : null;
        const badge3D = is3D ? `<span class="badge-3d-mini" style="background: ${quality3D.color}; color: #000; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; margin-left: 4px;" title="3D Compatible: ${quality3D.label}">🧊</span>` : '';

        return `
            <div class="series-item animate-slideUp ${is3D ? 'series-3d-compatible' : ''}" 
                 style="animation-delay: ${index * 0.05}s"
                 ondblclick="loadSeriesInViewer('${studyUid}', '${s.seriesInstanceUid}')"
                 draggable="true"
                 ondragstart="onSeriesDragStart(event, '${studyUid}', '${s.seriesInstanceUid}')"
                 data-uid="${s.seriesInstanceUid}"
                 data-3d-compatible="${is3D}">
                <div class="series-thumbnail" id="series-thumb-${s.seriesInstanceUid}">
                    <span>${s.modality || '?'}</span>
                </div>
                <div class="series-info">
                    <div class="series-modality">${s.modality || 'N/A'} #${s.seriesNumber || '?'}${badge3D}</div>
                    <div class="series-desc">${escapeHtml(s.seriesDescription) || 'No description'}</div>
                    <div class="series-count">${s.numberOfSeriesRelatedInstances || 0} images ${is3D ? `<span style="color: ${quality3D.color}; font-size: 0.7rem;">(${quality3D.label})</span>` : ''}</div>
                </div>
            </div>
        `;
    }).join('');

    // Load thumbnails asynchronously
    series.forEach(s => loadSeriesThumbnail(studyUid, s));
}

/**
 * Load thumbnail for a series
 */
async function loadSeriesThumbnail(studyUid, series, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
        const instances = await api.searchInstances(studyUid, series.seriesInstanceUid, { limit: 1 });

        if (instances && instances.length > 0) {
            const response = await api.getThumbnail(studyUid, series.seriesInstanceUid, instances[0].sopInstanceUid, 56);

            // Handle 202 Accepted - file is being retrieved from PACS
            if (response.status === 202) {
                if (retryCount < MAX_RETRIES) {
                    setTimeout(() => {
                        loadSeriesThumbnail(studyUid, series, retryCount + 1);
                    }, RETRY_DELAY);
                }
                return;
            }

            if (response.ok) {
                const blob = await response.blob();
                const thumbEl = document.getElementById(`series-thumb-${series.seriesInstanceUid}`);
                if (thumbEl) {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(blob);
                    img.alt = series.seriesDescription || 'Series thumbnail';
                    thumbEl.innerHTML = '';
                    thumbEl.appendChild(img);
                }
            }
        }
    } catch (e) {
        // Keep text placeholder on error
        console.debug('Thumbnail load failed for series:', series.seriesInstanceUid);
    }
}

/**
 * Load series into viewer
 */
function loadSeriesInViewer(studyUid, seriesUid) {
    console.log('[StudyBrowser] loadSeriesInViewer called:', { studyUid, seriesUid });

    if (!studyUid || !seriesUid) {
        console.error('[StudyBrowser] Missing studyUid or seriesUid');
        showToast('Error', 'Missing study or series ID', 'error');
        return;
    }

    // Provide immediate visual feedback
    showToast('Loading', 'Loading series into viewer...', 'info');

    // Check if viewportManager exists
    if (!viewportManager) {
        console.error('[StudyBrowser] viewportManager not initialized');
        showToast('Error', 'Viewer not initialized', 'error');
        return;
    }

    // Load the series
    try {
        viewportManager.loadSeries(studyUid, seriesUid);
    } catch (error) {
        console.error('[StudyBrowser] Error calling viewportManager.loadSeries:', error);
        showToast('Error', 'Failed to load series: ' + error.message, 'error');
        return;
    }

    // Update series selection
    document.querySelectorAll('.series-item').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.querySelector(`.series-item[data-uid="${seriesUid}"]`);
    if (selectedEl) selectedEl.classList.add('selected');

    // Store current series
    const series = window.appState.series.find(s => s.seriesInstanceUid === seriesUid);
    window.appState.currentSeries = series;

    // Update info panel
    if (window.appState.currentStudy && series) {
        updateInfoPanel(window.appState.currentStudy, series);
    }
}

/**
 * Quick load first series of a study
 */
async function quickLoadStudy(studyUid) {
    console.log('[StudyBrowser] quickLoadStudy called with:', studyUid);
    try {
        // Get selected PACS node
        const pacsNode = document.getElementById('pacsNode')?.value || '';
        const params = pacsNode ? { pacsNode } : {};

        const response = await api.searchSeries(studyUid, params);
        const series = Array.isArray(response) ? response : [];
        console.log('[StudyBrowser] quickLoadStudy found', series.length, 'series');

        if (series && series.length > 0) {
            await selectStudy(studyUid);
            loadSeriesInViewer(studyUid, series[0].seriesInstanceUid);
        } else {
            showToast('Warning', 'No series found in study', 'warning');
        }
    } catch (error) {
        console.error('[StudyBrowser] quickLoadStudy error:', error);
        showToast('Error', 'Failed to quick load study: ' + error.message, 'error');
    }
}

/**
 * Handle series drag start
 */
function onSeriesDragStart(event, studyUid, seriesUid) {
    event.dataTransfer.setData('application/json', JSON.stringify({
        studyUid,
        seriesUid
    }));
    event.dataTransfer.effectAllowed = 'copy';
    event.target.classList.add('dragging');
}

/**
 * Close series panel
 */
function closeSeriesPanel() {
    document.getElementById('seriesPanel').classList.remove('show');
}

/**
 * Clear search form
 */
function clearSearch() {
    document.getElementById('patientId').value = '';
    document.getElementById('patientName').value = '';
    document.getElementById('studyDateFrom').value = '';
    document.getElementById('studyDateTo').value = '';
    const modalitySelect = document.getElementById('modality');
    Array.from(modalitySelect.options).forEach(opt => opt.selected = false);
    document.getElementById('accessionNumber').value = '';

    document.getElementById('studyList').innerHTML = `
        <div class="empty-state">
            <div class="icon">🔍</div>
            <h4>Search for Studies</h4>
            <p>Enter search criteria above to find DICOM studies</p>
        </div>
    `;
    document.getElementById('studyListHeader').style.display = 'none';
    closeSeriesPanel();

    window.appState.studies = [];
    window.appState.series = [];
    window.appState.currentStudy = null;
    window.appState.currentSeries = null;

    updateHeaderStudyInfo(null);
}

/**
 * Refresh current search
 */
function refreshSearch() {
    searchStudies();
}

/**
 * Toggle sidebar
 */
function toggleSidebar() {
    const sidebar = document.getElementById('studySidebar');
    sidebar.classList.toggle('collapsed');

    const btn = sidebar.querySelector('.collapse-btn span');
    btn.textContent = sidebar.classList.contains('collapsed') ? '▶' : '◀';
}

/**
 * Update info panel with study/series data
 */
function updateInfoPanel(study, series) {
    if (study) {
        const patientInfo = document.getElementById('patientInfo');
        patientInfo.innerHTML = `
            <div class="info-row">
                <span class="label">Name</span>
                <span class="value">${escapeHtml(study.patientName) || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">ID</span>
                <span class="value">${study.patientId || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">DOB</span>
                <span class="value">${formatDicomDate(study.patientBirthDate)}</span>
            </div>
            <div class="info-row">
                <span class="label">Sex</span>
                <span class="value">${study.patientSex || 'N/A'}</span>
            </div>
        `;

        const studyInfoPanel = document.getElementById('studyInfoPanel');
        studyInfoPanel.innerHTML = `
            <div class="info-row">
                <span class="label">Date</span>
                <span class="value">${formatDicomDate(study.studyDate)}</span>
            </div>
            <div class="info-row">
                <span class="label">Accession</span>
                <span class="value">${study.accessionNumber || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">Description</span>
                <span class="value">${escapeHtml(study.studyDescription) || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">Referring</span>
                <span class="value">${escapeHtml(study.referringPhysicianName) || 'N/A'}</span>
            </div>
        `;
    }

    if (series) {
        const seriesInfoPanel = document.getElementById('seriesInfoPanel');
        seriesInfoPanel.innerHTML = `
            <div class="info-row">
                <span class="label">Modality</span>
                <span class="value">${series.modality || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">Description</span>
                <span class="value">${escapeHtml(series.seriesDescription) || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">Body Part</span>
                <span class="value">${series.bodyPartExamined || 'N/A'}</span>
            </div>
            <div class="info-row">
                <span class="label">Images</span>
                <span class="value">${series.numberOfSeriesRelatedInstances || 0}</span>
            </div>
        `;
    }
}

/**
 * Load PACS nodes into dropdown
 */
async function loadPacsNodes() {
    try {
        const nodes = await api.getPacsNodes();
        const select = document.getElementById('pacsNode');

        select.innerHTML = '<option value="">Default PACS Server</option>' +
            nodes.map(n => `<option value="${n.name}">${escapeHtml(n.name)} (${n.aeTitle})</option>`).join('');

    } catch (error) {
        console.error('Error loading PACS nodes:', error);
    }
}

/**
 * Show right panel tab
 */
function showPanel(panelName) {
    // Update tab buttons
    document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.classList.toggle('active', tab.dataset.panel === panelName);
    });

    // Show/hide panels
    document.getElementById('thumbnailsPanel').style.display = panelName === 'thumbnails' ? 'block' : 'none';
    document.getElementById('infoPanel').style.display = panelName === 'info' ? 'block' : 'none';
    document.getElementById('segmentationPanel').style.display = panelName === 'segmentation' ? 'block' : 'none';
    document.getElementById('annotationsPanel').style.display = panelName === 'annotations' ? 'block' : 'none';

    // Update panel actions based on active panel
    updatePanelActions(panelName);
}

/**
 * Update panel action buttons based on active panel
 */
function updatePanelActions(panelName) {
    const saveBtn = document.getElementById('saveAnnotationsBtn');
    const exportBtn = document.getElementById('exportAnnotationsBtn');

    if (panelName === 'annotations') {
        saveBtn.style.display = 'inline-flex';
        exportBtn.style.display = 'inline-flex';
        saveBtn.onclick = () => saveAnnotationsToSR();
        exportBtn.onclick = () => annotationManager.exportAsJSON();
    } else if (panelName === 'segmentation') {
        saveBtn.style.display = 'inline-flex';
        exportBtn.style.display = 'inline-flex';
        saveBtn.textContent = '💾 Save';
        saveBtn.onclick = () => segmentationManager.saveToServer();
        exportBtn.textContent = '📤 Export SEG';
        exportBtn.onclick = () => exportSegToDicomSeg();
    } else {
        saveBtn.style.display = 'none';
        exportBtn.style.display = 'none';
    }
}

/**
 * Format DICOM date (YYYYMMDD -> YYYY-MM-DD)
 */
function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr || 'N/A';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Show enhanced toast notification
 */
function showToast(title, message, type = 'info') {
    const container = document.getElementById('toastContainer');

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
            <div class="toast-title">${escapeHtml(title)}</div>
            ${message ? `<div class="toast-message">${escapeHtml(message)}</div>` : ''}
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
 * Search for 3D-compatible studies (multi-slice CT/MR)
 * These are studies that have enough slices for meaningful 3D reconstruction
 */
async function search3DCompatible() {
    // Clear existing filters
    clearSearch();

    // Set modality filter to CT
    const modalitySelect = document.getElementById('modality');
    if (modalitySelect) {
        modalitySelect.value = 'CT';
    }

    showToast('3D Search', 'Searching for 3D-compatible CT/MR studies...', 'info');

    const loading = document.getElementById('searchLoading');
    const studyList = document.getElementById('studyList');
    const studyListHeader = document.getElementById('studyListHeader');

    loading.classList.add('show');
    studyList.innerHTML = '';
    if (studyListHeader) studyListHeader.style.display = 'none';

    try {
        const pacsNode = document.getElementById('pacsNode').value;

        // Search for CT studies
        const ctParams = { ModalitiesInStudy: 'CT' };
        if (pacsNode) ctParams.pacsNode = pacsNode;

        let ctStudies = [];
        try {
            const ctResponse = await api.searchStudies(ctParams);
            ctStudies = Array.isArray(ctResponse) ? ctResponse : [];
        } catch (e) {
            console.warn('CT search failed:', e);
        }

        // Search for MR studies
        const mrParams = { ModalitiesInStudy: 'MR' };
        if (pacsNode) mrParams.pacsNode = pacsNode;

        let mrStudies = [];
        try {
            const mrResponse = await api.searchStudies(mrParams);
            mrStudies = Array.isArray(mrResponse) ? mrResponse : [];
        } catch (e) {
            console.warn('MR search failed:', e);
        }

        // Combine and filter for multi-slice studies (more than 10 images)
        const allStudies = [...ctStudies, ...mrStudies];
        const volumeStudies = allStudies.filter(study => {
            const imageCount = parseInt(study.numberOfStudyRelatedInstances) || 0;
            return imageCount >= 10; // At least 10 images for 3D
        });

        // Sort by image count (more images = better for 3D)
        volumeStudies.sort((a, b) => {
            const countA = parseInt(a.numberOfStudyRelatedInstances) || 0;
            const countB = parseInt(b.numberOfStudyRelatedInstances) || 0;
            return countB - countA;
        });

        window.appState.studies = volumeStudies;

        if (volumeStudies.length === 0) {
            studyList.innerHTML = `
                <div class="empty-state animate-fadeIn">
                    <div class="icon">🧊</div>
                    <h4>No 3D-Compatible Studies Found</h4>
                    <p>3D reconstruction requires CT or MR studies with 10+ images</p>
                </div>`;
        } else {
            display3DCompatibleStudies(volumeStudies);
            if (studyListHeader) studyListHeader.style.display = 'flex';
            const studyCountEl = document.getElementById('studyCountNum');
            if (studyCountEl) studyCountEl.textContent = volumeStudies.length;
        }

        showToast('3D Search Complete', `Found ${volumeStudies.length} 3D-compatible studies`, 'success');

    } catch (error) {
        console.error('3D search error:', error);
        studyList.innerHTML = `
            <div class="empty-state animate-fadeIn">
                <div class="icon">⚠️</div>
                <h4>Search Failed</h4>
                <p>${error.message || 'Unable to connect to PACS server'}</p>
            </div>`;
        showToast('Search Error', error.message, 'error');
    } finally {
        loading.classList.remove('show');
    }
}

/**
 * Display 3D-compatible studies with special indicators
 */
function display3DCompatibleStudies(studies) {
    const studyList = document.getElementById('studyList');

    studyList.innerHTML = studies.map((study, index) => {
        const imageCount = parseInt(study.numberOfStudyRelatedInstances) || 0;
        const qualityLabel = imageCount >= 100 ? '⭐ Excellent' : (imageCount >= 50 ? '✓ Very Good' : '○ Good');
        const qualityColor = imageCount >= 100 ? '#4ade80' : (imageCount >= 50 ? '#60a5fa' : '#fbbf24');

        return `
            <div class="study-card animate-slideUp" 
                 style="animation-delay: ${index * 0.05}s"
                 onclick="selectStudy('${study.studyInstanceUid}')" 
                 data-uid="${study.studyInstanceUid}">
                <div class="study-card-header">
                    <div class="patient-info">
                        <span class="patient-name">${escapeHtml(study.patientName) || 'Unknown'}</span>
                        <span class="badge-3d" style="background: ${qualityColor}; color: #000; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">
                            🧊 ${qualityLabel}
                        </span>
                    </div>
                    <span class="modality-badge">${study.modalitiesInStudy || 'N/A'}</span>
                </div>
                <div class="study-card-body">
                    <div class="study-meta-row">
                        <span class="patient-id">ID: ${study.patientId || 'N/A'}</span>
                        <span class="study-date">${formatDicomDate(study.studyDate)}</span>
                    </div>
                    <div class="study-description">${escapeHtml(study.studyDescription) || 'No description'}</div>
                    <div class="study-counts">
                        <span>📁 ${study.numberOfStudyRelatedSeries || 0} series</span>
                        <span style="color: ${qualityColor}; font-weight: 600;">🖼️ ${imageCount} images</span>
                    </div>
                </div>
            </div>
        `;
    }).join('');
}

/**
 * Check if a series is suitable for 3D reconstruction
 */
function is3DCompatibleSeries(series) {
    const modality = (series.modality || '').toUpperCase();
    const imageCount = parseInt(series.numberOfSeriesRelatedInstances) || 0;

    // Must be CT or MR
    if (!['CT', 'MR', 'MRI', 'PT', 'NM'].includes(modality)) {
        return false;
    }

    // Must have at least 10 slices
    return imageCount >= 10;
}

/**
 * Get 3D quality rating for a series
 */
function get3DQuality(series) {
    const imageCount = parseInt(series.numberOfSeriesRelatedInstances) || 0;

    if (imageCount >= 200) return { rating: 'excellent', label: '⭐ Excellent', color: '#4ade80' };
    if (imageCount >= 100) return { rating: 'very-good', label: '✓ Very Good', color: '#60a5fa' };
    if (imageCount >= 50) return { rating: 'good', label: '○ Good', color: '#fbbf24' };
    if (imageCount >= 20) return { rating: 'basic', label: '△ Basic', color: '#f97316' };
    return { rating: 'minimal', label: '▽ Minimal', color: '#ef4444' };
}

/**
 * Show keyboard shortcuts modal
 */
function showKeyboardShortcuts() {
    document.getElementById('shortcutsModal').style.display = 'flex';
}

/**
 * Hide keyboard shortcuts modal
 */
function hideKeyboardShortcuts() {
    document.getElementById('shortcutsModal').style.display = 'none';
}

/**
 * Set active viewport
 */
function setActiveViewport(index) {
    window.appState.selectedViewport = index;
    document.querySelectorAll('.viewport').forEach((vp, i) => {
        vp.classList.toggle('active', i === index);
    });
}

// Export functions to global scope
window.searchStudies = searchStudies;
window.selectStudy = selectStudy;
window.loadSeriesInViewer = loadSeriesInViewer;
window.quickLoadStudy = quickLoadStudy;
window.clearSearch = clearSearch;
window.refreshSearch = refreshSearch;
window.toggleSidebar = toggleSidebar;
window.closeSeriesPanel = closeSeriesPanel;
window.showPanel = showPanel;
window.showToast = showToast;
window.showKeyboardShortcuts = showKeyboardShortcuts;
window.hideKeyboardShortcuts = hideKeyboardShortcuts;
window.setActiveViewport = setActiveViewport;
window.onSeriesDragStart = onSeriesDragStart;
window.loadPacsNodes = loadPacsNodes;
window.formatDicomDate = formatDicomDate;
window.escapeHtml = escapeHtml;
window.search3DCompatible = search3DCompatible;
window.display3DCompatibleStudies = display3DCompatibleStudies;
window.is3DCompatibleSeries = is3DCompatibleSeries;
window.get3DQuality = get3DQuality;

