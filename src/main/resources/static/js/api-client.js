/**
 * API Client for Raster PACS
 */
class ApiClient {
    constructor(baseUrl = '') {
        this.baseUrl = baseUrl;
    }

    async fetch(url, options = {}) {
        const fullUrl = this.baseUrl + url;
        console.log('API Request:', fullUrl);

        try {
            const response = await fetch(fullUrl, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                }
            });

            console.log('API Response status:', response.status);

            if (!response.ok) {
                const errorText = await response.text();
                console.error('API Error response:', errorText);
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const contentType = response.headers.get('content-type');
            if (contentType && (contentType.includes('application/json') || contentType.includes('application/dicom+json'))) {
                const data = await response.json();
                console.log('API Response data:', Array.isArray(data) ? `Array with ${data.length} items` : data);
                return data;
            }
            return response;
        } catch (error) {
            console.error('API Fetch error:', error);
            throw error;
        }
    }

    // PACS Node APIs
    async getPacsNodes() {
        return this.fetch('/api/pacs/nodes');
    }

    async testPacsNode(nodeName) {
        return this.fetch(`/api/pacs/nodes/${nodeName}/echo`);
    }

    // QIDO-RS APIs
    async searchStudies(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetch(`/dicomweb/studies?${queryString}`);
    }

    async searchSeries(studyUid, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetch(`/dicomweb/studies/${studyUid}/series?${queryString}`);
    }

    async searchInstances(studyUid, seriesUid, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.fetch(`/dicomweb/studies/${studyUid}/series/${seriesUid}/instances?${queryString}`);
    }

    // WADO-RS APIs
    async getInstance(studyUid, seriesUid, instanceUid) {
        return fetch(`${this.baseUrl}/dicomweb/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}`);
    }

    async getInstanceMetadata(studyUid, seriesUid, instanceUid) {
        return this.fetch(`/dicomweb/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}/metadata`);
    }

    async getRenderedInstance(studyUid, seriesUid, instanceUid, params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return fetch(`${this.baseUrl}/dicomweb/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}/rendered?${queryString}`);
    }

    async getThumbnail(studyUid, seriesUid, instanceUid, size = 128) {
        return fetch(`${this.baseUrl}/dicomweb/studies/${studyUid}/series/${seriesUid}/instances/${instanceUid}/thumbnail?size=${size}`);
    }

    // WADO-URI API
    getWadoUri(studyUid, seriesUid, instanceUid, contentType = 'application/dicom') {
        return `${this.baseUrl}/wado?requestType=WADO&studyUID=${studyUid}&seriesUID=${seriesUid}&objectUID=${instanceUid}&contentType=${encodeURIComponent(contentType)}`;
    }

    // Retrieve APIs
    async retrieveStudy(studyUid, pacsNode = null) {
        const params = pacsNode ? `?pacsNode=${pacsNode}` : '';
        return this.fetch(`/api/retrieve/study/${studyUid}${params}`, { method: 'POST' });
    }

    async retrieveSeries(studyUid, seriesUid, pacsNode = null) {
        const params = pacsNode ? `?pacsNode=${pacsNode}` : '';
        return this.fetch(`/api/retrieve/study/${studyUid}/series/${seriesUid}${params}`, { method: 'POST' });
    }

    async getRetrieveStatus(studyUid) {
        return this.fetch(`/api/retrieve/status/${studyUid}`);
    }

    async getCacheStats() {
        return this.fetch('/api/retrieve/cache/stats');
    }

    // Cache APIs
    async deleteCachedStudy(studyUid) {
        return this.fetch(`/api/retrieve/cache/${studyUid}`, { method: 'DELETE' });
    }

    // Local Studies APIs
    async getLocalStudies() {
        return this.fetch('/api/studies');
    }

    async getLocalStudy(studyUid) {
        return this.fetch(`/api/studies/${studyUid}`);
    }

    // Annotation APIs
    async saveAnnotation(annotation) {
        return this.fetch('/api/annotations', {
            method: 'POST',
            body: JSON.stringify(annotation)
        });
    }

    async saveAnnotations(annotations) {
        return this.fetch('/api/annotations/batch', {
            method: 'POST',
            body: JSON.stringify(annotations)
        });
    }

    async getStudyAnnotations(studyUid) {
        return this.fetch(`/api/annotations/study/${studyUid}`);
    }

    async getSeriesAnnotations(studyUid, seriesUid) {
        return this.fetch(`/api/annotations/study/${studyUid}/series/${seriesUid}`);
    }

    async getInstanceAnnotations(studyUid, seriesUid, instanceUid) {
        return this.fetch(`/api/annotations/study/${studyUid}/series/${seriesUid}/instance/${instanceUid}`);
    }

    async deleteAnnotation(id) {
        return this.fetch(`/api/annotations/${id}`, { method: 'DELETE' });
    }

    async saveAnnotationsAsSR(request) {
        return this.fetch('/api/annotations/save-as-sr', {
            method: 'POST',
            body: JSON.stringify(request)
        });
    }

    // Segmentation APIs
    async saveSegmentation(segmentation) {
        return this.fetch('/api/segmentations', {
            method: 'POST',
            body: JSON.stringify(segmentation)
        });
    }

    async updateSegmentation(id, segmentation) {
        return this.fetch(`/api/segmentations/${id}`, {
            method: 'PUT',
            body: JSON.stringify(segmentation)
        });
    }

    async getStudySegmentations(studyUid) {
        return this.fetch(`/api/segmentations/study/${studyUid}`);
    }

    async getSeriesSegmentations(studyUid, seriesUid) {
        return this.fetch(`/api/segmentations/study/${studyUid}/series/${seriesUid}`);
    }

    async getSegmentation(id) {
        return this.fetch(`/api/segmentations/${id}`);
    }

    async deleteSegmentation(id) {
        return this.fetch(`/api/segmentations/${id}`, { method: 'DELETE' });
    }

    async getSegmentationVolume(id) {
        return this.fetch(`/api/segmentations/${id}/volume`);
    }

    async exportSegmentationToSEG(id, pacsNode = null) {
        const params = pacsNode ? `?pacsNode=${pacsNode}` : '';
        return this.fetch(`/api/segmentations/${id}/export-seg${params}`, { method: 'POST' });
    }

    async exportSegmentationsToSEG(segmentationIds, pacsNode = null) {
        return this.fetch('/api/segmentations/export-seg', {
            method: 'POST',
            body: JSON.stringify({
                segmentationIds: segmentationIds,
                pacsNode: pacsNode
            })
        });
    }

    // Report APIs
    async createReport(report) {
        return this.fetch('/api/reports', {
            method: 'POST',
            body: JSON.stringify(report)
        });
    }

    async updateReport(id, report) {
        return this.fetch(`/api/reports/${id}`, {
            method: 'PUT',
            body: JSON.stringify(report)
        });
    }

    async saveReportDraft(id, report) {
        const params = id ? `?id=${id}` : '';
        return this.fetch(`/api/reports/draft${params}`, {
            method: 'POST',
            body: JSON.stringify(report)
        });
    }

    async getReport(id) {
        return this.fetch(`/api/reports/${id}`);
    }

    async getStudyReports(studyUid) {
        return this.fetch(`/api/reports/study/${studyUid}`);
    }

    async getUserDrafts(userId) {
        return this.fetch(`/api/reports/drafts?userId=${userId}`);
    }

    async getPendingReports() {
        return this.fetch('/api/reports/pending');
    }

    async signReport(id, signedBy, signature) {
        return this.fetch(`/api/reports/${id}/sign`, {
            method: 'POST',
            body: JSON.stringify({ signedBy, digitalSignature: signature })
        });
    }

    async deleteReport(id) {
        return this.fetch(`/api/reports/${id}`, { method: 'DELETE' });
    }

    async exportReportToPdf(id) {
        return this.fetch(`/api/reports/${id}/pdf`);
    }

    async exportReportToSR(id, pacsNode = null) {
        const params = pacsNode ? `?pacsNode=${pacsNode}` : '';
        return this.fetch(`/api/reports/${id}/export-sr${params}`, { method: 'POST' });
    }

    async getReportTemplates() {
        return this.fetch('/api/reports/templates');
    }

    async getReportTemplate(templateId) {
        return this.fetch(`/api/reports/templates/${templateId}`);
    }

    async getReportStatistics() {
        return this.fetch('/api/reports/stats');
    }

    // Collaboration APIs
    async createSession(sessionId, userId, userName, userRole) {
        return this.fetch('/api/collaboration/sessions', {
            method: 'POST',
            body: JSON.stringify({ sessionId, userId, userName, userRole })
        });
    }

    async endSession(sessionId) {
        return this.fetch(`/api/collaboration/sessions/${sessionId}`, { method: 'DELETE' });
    }

    async getActiveSessions() {
        return this.fetch('/api/collaboration/sessions');
    }

    async getStudyViewers(studyUid) {
        return this.fetch(`/api/collaboration/sessions/study/${studyUid}`);
    }

    async getSessionStats() {
        return this.fetch('/api/collaboration/sessions/stats');
    }

    // Audit APIs
    async getStudyAuditLogs(studyUid, page = 0, size = 50) {
        return this.fetch(`/api/collaboration/audit/study/${studyUid}?page=${page}&size=${size}`);
    }

    async getUserAuditLogs(userId, page = 0, size = 50) {
        return this.fetch(`/api/collaboration/audit/user/${userId}?page=${page}&size=${size}`);
    }

    async getAuditLogs(page = 0, size = 50) {
        return this.fetch(`/api/collaboration/audit?page=${page}&size=${size}`);
    }

    async getStudyAccessHistory(studyUid) {
        return this.fetch(`/api/collaboration/audit/study/${studyUid}/access`);
    }

    async getAuditStats(days = 7) {
        return this.fetch(`/api/collaboration/audit/stats?days=${days}`);
    }

    // 3D Volume Rendering APIs
    /**
     * Get raw pixel data for 3D volume rendering
     * Returns a multipart response with JSON metadata and binary pixel data
     * @param {string} studyUid - Study Instance UID
     * @param {string} seriesUid - Series Instance UID
     * @param {number} subsample - Subsample factor (1=all, 2=every 2nd, 4=every 4th slice)
     * @returns {Promise<Response>} Raw fetch response for multipart parsing
     */
    async getVolumePixelData(studyUid, seriesUid, subsample = 1) {
        const url = `${this.baseUrl}/dicomweb/studies/${studyUid}/series/${seriesUid}/pixeldata?subsample=${subsample}`;
        console.log('Fetching volume pixel data:', url);
        return fetch(url);
    }
}

// Create global instance
const api = new ApiClient(CONFIG.API_BASE);

