/**
 * Study Browser
 * Handles searching, displaying, and selecting studies
 */

// App state
window.appState = {
    currentStudy: null,
    currentSeries: null,
    studies: [],
    series: []
};

/**
 * Search studies from PACS
 */
async function searchStudies() {
    const loading = document.getElementById('searchLoading');
    const studyList = document.getElementById('studyList');

    loading.classList.add('show');
    studyList.innerHTML = '';

    // Build query parameters
    const params = {};

    const patientId = document.getElementById('patientId').value;
    const patientName = document.getElementById('patientName').value;
    const dateFrom = document.getElementById('studyDateFrom').value;
    const dateTo = document.getElementById('studyDateTo').value;
    const modalitySelect = document.getElementById('modality');
    const selectedModalities = Array.from(modalitySelect.selectedOptions).map(opt => opt.value).filter(v => v);
    const modality = selectedModalities.join('\\');
    const accessionNumber = document.getElementById('accessionNumber').value;
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
            studyList.innerHTML = '<div class="empty-state">No studies found</div>';
        } else {
            displayStudies(studies);
        }

        showToast(`Found ${studies.length} studies`, 'success');

    } catch (error) {
        console.error('Search error:', error);
        studyList.innerHTML = `<div class="empty-state" style="color: var(--error)">
            Search failed: ${error.message}
        </div>`;
        showToast(`Search failed: ${error.message}`, 'error');
    } finally {
        loading.classList.remove('show');
    }
}

/**
 * Display studies in the list
 */
function displayStudies(studies) {
    const studyList = document.getElementById('studyList');

    studyList.innerHTML = studies.map(study => `
        <div class="study-item" onclick="selectStudy('${study.studyInstanceUid}')" data-uid="${study.studyInstanceUid}">
            <div class="patient-name">${study.patientName || 'Unknown'}</div>
            <div class="patient-id">ID: ${study.patientId || 'N/A'}</div>
            <div class="study-meta">
                <span>${formatDicomDate(study.studyDate)}</span>
                <span class="modality-badge">${study.modalitiesInStudy || 'N/A'}</span>
            </div>
            <div class="description">${study.studyDescription || 'No description'}</div>
            <div class="study-meta">
                <span>Series: ${study.numberOfStudyRelatedSeries || 0}</span>
                <span>Images: ${study.numberOfStudyRelatedInstances || 0}</span>
            </div>
        </div>
    `).join('');
}

/**
 * Select a study and load its series
 */
async function selectStudy(studyUid) {
    // Update selection visual
    document.querySelectorAll('.study-item').forEach(el => el.classList.remove('selected'));
    const selectedEl = document.querySelector(`.study-item[data-uid="${studyUid}"]`);
    if (selectedEl) selectedEl.classList.add('selected');

    // Find study data
    const study = window.appState.studies.find(s => s.studyInstanceUid === studyUid);
    window.appState.currentStudy = study;

    // Update header
    document.getElementById('currentStudyInfo').textContent =
        `${study?.patientName || 'Unknown'} - ${formatDicomDate(study?.studyDate)}`;

    // Show series panel
    const seriesPanel = document.getElementById('seriesPanel');
    seriesPanel.style.display = 'flex';

    const seriesList = document.getElementById('seriesList');
    seriesList.innerHTML = '<div class="loading show"><div class="spinner"></div>Loading series...</div>';

    try {
        // Get selected PACS node
        const pacsNode = document.getElementById('pacsNode')?.value || '';
        const params = pacsNode ? { pacsNode } : {};

        const response = await api.searchSeries(studyUid, params);
        // Ensure series is always an array
        const series = Array.isArray(response) ? response : [];
        window.appState.series = series;

        if (series.length === 0) {
            seriesList.innerHTML = '<div class="empty-state">No series found</div>';
            return;
        }

        displaySeries(studyUid, series);

        // Update patient info panel
        updateInfoPanel(study, series[0]);

        // Auto-load first series into viewer
        loadSeriesInViewer(studyUid, series[0].seriesInstanceUid);

    } catch (error) {
        console.error('Error loading series:', error);
        seriesList.innerHTML = `<div class="empty-state" style="color: var(--error)">
            Failed to load series: ${error.message}
        </div>`;
    }
}

/**
 * Display series in the panel
 */
function displaySeries(studyUid, series) {
    const seriesList = document.getElementById('seriesList');

    seriesList.innerHTML = series.map(s => {
        const is3D = is3DCompatibleSeries(s);
        const quality3D = is3D ? get3DQuality(s) : null;
        const badge3D = is3D ? `<span class="badge-3d-mini" style="background: ${quality3D.color}; color: #000; font-size: 0.6rem; padding: 1px 4px; border-radius: 3px; margin-left: 4px;" title="3D Compatible: ${quality3D.label}">🧊</span>` : '';

        return `
            <div class="series-item ${is3D ? 'series-3d-compatible' : ''}" 
                 ondblclick="loadSeriesInViewer('${studyUid}', '${s.seriesInstanceUid}')"
                 draggable="true"
                 ondragstart="onSeriesDragStart(event, '${studyUid}', '${s.seriesInstanceUid}')"
                 data-uid="${s.seriesInstanceUid}"
                 data-3d-compatible="${is3D}">
                <div class="thumbnail" id="series-thumb-${s.seriesInstanceUid}">
                    ${s.modality || '?'}
                </div>
                <div class="series-info">
                    <div class="series-modality">${s.modality || 'N/A'} - #${s.seriesNumber || '?'}${badge3D}</div>
                    <div class="series-desc">${s.seriesDescription || 'No description'}</div>
                    <div class="series-desc">${s.numberOfSeriesRelatedInstances || 0} images ${is3D ? `<span style="color: ${quality3D.color};">(${quality3D.label})</span>` : ''}</div>
                </div>
            </div>
        `;
    }).join('');

    // Load thumbnails for each series
    series.forEach(s => loadSeriesThumbnail(studyUid, s));
}

/**
 * Load thumbnail for a series
 */
async function loadSeriesThumbnail(studyUid, series, retryCount = 0) {
    const MAX_RETRIES = 3;
    const RETRY_DELAY = 2000; // 2 seconds

    try {
        // Get first instance of series
        const instances = await api.searchInstances(studyUid, series.seriesInstanceUid, { limit: 1 });

        if (instances && instances.length > 0) {
            const response = await api.getThumbnail(studyUid, series.seriesInstanceUid, instances[0].sopInstanceUid, 50);

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
                    img.style.cssText = 'width: 100%; height: 100%; object-fit: cover;';
                    thumbEl.innerHTML = '';
                    thumbEl.appendChild(img);
                }
            }
        }
    } catch (e) {
        // Keep text placeholder
    }
}

/**
 * Load series into viewer (double-click handler)
 */
function loadSeriesInViewer(studyUid, seriesUid) {
    viewportManager.loadSeries(studyUid, seriesUid);
}

/**
 * Handle series drag start
 */
function onSeriesDragStart(event, studyUid, seriesUid) {
    event.dataTransfer.setData('application/json', JSON.stringify({
        studyUid,
        seriesUid
    }));
}

/**
 * Close series panel
 */
function closeSeriesPanel() {
    document.getElementById('seriesPanel').style.display = 'none';
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
    document.getElementById('studyList').innerHTML = '<div class="empty-state">Search for studies above</div>';
    closeSeriesPanel();
}

/**
 * Toggle sidebar
 */
function toggleSidebar() {
    document.getElementById('studySidebar').classList.toggle('collapsed');
}

/**
 * Update info panel
 */
function updateInfoPanel(study, series) {
    if (study) {
        document.getElementById('patientInfo').innerHTML = `
            <div><strong>Name:</strong> ${study.patientName || 'N/A'}</div>
            <div><strong>ID:</strong> ${study.patientId || 'N/A'}</div>
            <div><strong>DOB:</strong> ${formatDicomDate(study.patientBirthDate)}</div>
            <div><strong>Sex:</strong> ${study.patientSex || 'N/A'}</div>
        `;

        document.getElementById('studyInfo').innerHTML = `
            <div><strong>Date:</strong> ${formatDicomDate(study.studyDate)}</div>
            <div><strong>Accession:</strong> ${study.accessionNumber || 'N/A'}</div>
            <div><strong>Description:</strong> ${study.studyDescription || 'N/A'}</div>
            <div><strong>Referring:</strong> ${study.referringPhysicianName || 'N/A'}</div>
        `;
    }

    if (series) {
        document.getElementById('seriesInfo').innerHTML = `
            <div><strong>Modality:</strong> ${series.modality || 'N/A'}</div>
            <div><strong>Description:</strong> ${series.seriesDescription || 'N/A'}</div>
            <div><strong>Body Part:</strong> ${series.bodyPartExamined || 'N/A'}</div>
        `;
    }
}

/**
 * Search for 3D-compatible studies (multi-slice CT/MR)
 * These are studies that have enough slices for meaningful 3D reconstruction
 */
async function search3DCompatible() {
    // Clear existing filters
    clearSearch();

    // Set modality filter to CT or MR
    const modalitySelect = document.getElementById('modality');
    if (modalitySelect) {
        modalitySelect.value = 'CT'; // Start with CT
    }

    showToast('Searching for 3D-compatible CT/MR studies...', 'info');

    const loading = document.getElementById('searchLoading');
    const studyList = document.getElementById('studyList');

    loading.classList.add('show');
    studyList.innerHTML = '';

    try {
        // Search for CT studies
        const ctParams = { ModalitiesInStudy: 'CT' };
        const pacsNode = document.getElementById('pacsNode').value;
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
                <div class="empty-state">
                    <div style="font-size: 2rem; margin-bottom: 10px;">🧊</div>
                    <div>No 3D-compatible studies found</div>
                    <div style="font-size: 0.8rem; color: #888; margin-top: 5px;">
                        3D requires CT or MR studies with 10+ images
                    </div>
                </div>`;
        } else {
            display3DCompatibleStudies(volumeStudies);
        }

        showToast(`Found ${volumeStudies.length} 3D-compatible studies`, 'success');

    } catch (error) {
        console.error('3D search error:', error);
        studyList.innerHTML = `<div class="empty-state" style="color: var(--error)">
            Search failed: ${error.message}
        </div>`;
        showToast(`Search failed: ${error.message}`, 'error');
    } finally {
        loading.classList.remove('show');
    }
}

/**
 * Display 3D-compatible studies with special indicators
 */
function display3DCompatibleStudies(studies) {
    const studyList = document.getElementById('studyList');

    studyList.innerHTML = studies.map(study => {
        const imageCount = parseInt(study.numberOfStudyRelatedInstances) || 0;
        const qualityLabel = imageCount >= 100 ? '⭐ Excellent for 3D' : (imageCount >= 50 ? '✓ Good for 3D' : '○ Basic 3D');
        const qualityColor = imageCount >= 100 ? '#4ade80' : (imageCount >= 50 ? '#60a5fa' : '#fbbf24');

        return `
            <div class="study-item" onclick="selectStudy('${study.studyInstanceUid}')" data-uid="${study.studyInstanceUid}">
                <div class="patient-name">
                    ${study.patientName || 'Unknown'}
                    <span class="badge-3d" style="background: ${qualityColor}; color: #000; font-size: 0.65rem; padding: 2px 6px; border-radius: 4px; margin-left: 8px;">
                        🧊 ${qualityLabel}
                    </span>
                </div>
                <div class="patient-id">ID: ${study.patientId || 'N/A'}</div>
                <div class="study-meta">
                    <span>${formatDicomDate(study.studyDate)}</span>
                    <span class="modality-badge">${study.modalitiesInStudy || 'N/A'}</span>
                </div>
                <div class="description">${study.studyDescription || 'No description'}</div>
                <div class="study-meta">
                    <span>Series: ${study.numberOfStudyRelatedSeries || 0}</span>
                    <span style="color: ${qualityColor}; font-weight: 600;">Images: ${imageCount}</span>
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
    if (imageCount < 10) {
        return false;
    }

    return true;
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
 * Load PACS nodes into dropdown
 */
async function loadPacsNodes() {
    try {
        const nodes = await api.getPacsNodes();
        const select = document.getElementById('pacsNode');

        select.innerHTML = '<option value="">Default PACS</option>' +
            nodes.map(n => `<option value="${n.name}">${n.name} (${n.aeTitle})</option>`).join('');

    } catch (error) {
        console.error('Error loading PACS nodes:', error);
    }
}

/**
 * Format DICOM date
 */
function formatDicomDate(dateStr) {
    if (!dateStr || dateStr.length < 8) return dateStr || 'N/A';
    return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
}

