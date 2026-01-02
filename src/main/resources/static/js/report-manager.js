/**
 * Report Manager
 * Handles radiology report creation, editing, and export
 */

class ReportManager {
    constructor() {
        this.currentReport = null;
        this.currentStudy = null;
        this.templates = [];
        this.macros = new Map();
        this.autosaveInterval = null;
        this.autosaveDelay = 30000; // 30 seconds
        this.isDirty = false;
    }

    /**
     * Initialize report manager
     */
    async initialize() {
        await this.loadTemplates();
        this.setupEventListeners();
        this.setupAutosave();
        console.log('Report Manager initialized');
    }

    /**
     * Load available templates
     */
    async loadTemplates() {
        try {
            const response = await fetch('/api/reports/templates');
            if (response.ok) {
                this.templates = await response.json();
                this.updateTemplateSelector();
            }
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Auto-expand textareas
        document.querySelectorAll('.report-textarea').forEach(textarea => {
            textarea.addEventListener('input', () => {
                this.autoExpandTextarea(textarea);
                this.markDirty();
            });
        });

        // Template selection
        document.getElementById('reportTemplate')?.addEventListener('change', (e) => {
            this.applyTemplate(e.target.value);
        });

        // Macro expansion
        document.querySelectorAll('.report-textarea').forEach(textarea => {
            textarea.addEventListener('keydown', (e) => {
                if (e.key === 'Tab') {
                    e.preventDefault();
                    this.expandMacro(textarea);
                }
            });
        });
    }

    /**
     * Setup autosave
     */
    setupAutosave() {
        this.autosaveInterval = setInterval(() => {
            if (this.isDirty && this.currentReport) {
                this.saveDraft();
            }
        }, this.autosaveDelay);
    }

    /**
     * Mark report as dirty (unsaved changes)
     */
    markDirty() {
        this.isDirty = true;
        document.getElementById('reportSaveStatus')?.classList.add('unsaved');
    }

    /**
     * Open report editor for a study
     */
    async openForStudy(studyUid, studyData = null) {
        this.currentStudy = studyData || { studyInstanceUid: studyUid };

        // Check for existing report
        try {
            const response = await fetch(`/api/reports/study/${studyUid}`);
            if (response.ok) {
                const reports = await response.json();
                if (reports.length > 0) {
                    // Load most recent report
                    this.currentReport = reports[0];
                    this.populateForm(this.currentReport);
                    showToast('Loaded existing report', 'info');
                } else {
                    // Create new report
                    this.createNewReport(studyUid, studyData);
                }
            }
        } catch (error) {
            console.error('Error loading report:', error);
            this.createNewReport(studyUid, studyData);
        }

        this.showReportEditor();
    }

    /**
     * Create a new report
     */
    createNewReport(studyUid, studyData) {
        this.currentReport = {
            studyInstanceUid: studyUid,
            patientId: studyData?.patientId || '',
            patientName: studyData?.patientName || '',
            accessionNumber: studyData?.accessionNumber || '',
            studyDate: studyData?.studyDate || null,
            referringPhysician: studyData?.referringPhysician || '',
            status: 'DRAFT',
            clinicalHistory: '',
            technique: '',
            comparison: '',
            findings: '',
            impression: '',
            recommendations: ''
        };

        this.populateForm(this.currentReport);

        // Apply default template if available
        const modality = studyData?.modality || 'CT';
        const defaultTemplate = this.templates.find(t => t.modality === modality && t.isDefault);
        if (defaultTemplate) {
            this.applyTemplate(defaultTemplate.templateId);
        }
    }

    /**
     * Populate form with report data
     */
    populateForm(report) {
        document.getElementById('reportPatientName').textContent = report.patientName || '-';
        document.getElementById('reportPatientId').textContent = report.patientId || '-';
        document.getElementById('reportAccession').textContent = report.accessionNumber || '-';
        document.getElementById('reportStudyDate').textContent = this.formatDate(report.studyDate);
        document.getElementById('reportStatus').textContent = report.status || 'DRAFT';

        document.getElementById('clinicalHistory').value = report.clinicalHistory || '';
        document.getElementById('technique').value = report.technique || '';
        document.getElementById('comparison').value = report.comparison || '';
        document.getElementById('findings').value = report.findings || '';
        document.getElementById('impression').value = report.impression || '';
        document.getElementById('recommendations').value = report.recommendations || '';

        // Auto-expand all textareas
        document.querySelectorAll('.report-textarea').forEach(ta => this.autoExpandTextarea(ta));

        this.isDirty = false;
        document.getElementById('reportSaveStatus')?.classList.remove('unsaved');
    }

    /**
     * Get form data
     */
    getFormData() {
        return {
            ...this.currentReport,
            clinicalHistory: document.getElementById('clinicalHistory')?.value || '',
            technique: document.getElementById('technique')?.value || '',
            comparison: document.getElementById('comparison')?.value || '',
            findings: document.getElementById('findings')?.value || '',
            impression: document.getElementById('impression')?.value || '',
            recommendations: document.getElementById('recommendations')?.value || '',
            reportingPhysician: document.getElementById('reportingPhysician')?.value || '',
            modifiedBy: 'current-user' // Would come from auth system
        };
    }

    /**
     * Apply a template
     */
    async applyTemplate(templateId) {
        if (!templateId) return;

        try {
            const response = await fetch(`/api/reports/templates/${templateId}`);
            if (response.ok) {
                const template = await response.json();

                if (template.defaultTechnique) {
                    document.getElementById('technique').value = template.defaultTechnique;
                }
                if (template.defaultFindings) {
                    document.getElementById('findings').value = template.defaultFindings;
                }
                if (template.defaultImpression) {
                    document.getElementById('impression').value = template.defaultImpression;
                }

                // Load macros
                if (template.macros) {
                    template.macros.forEach(m => {
                        this.macros.set(m.shortcut, m.expansion);
                    });
                }

                this.currentReport.templateId = templateId;
                this.currentReport.templateName = template.name;
                this.markDirty();

                showToast(`Applied template: ${template.name}`, 'success');
            }
        } catch (error) {
            console.error('Error applying template:', error);
        }
    }

    /**
     * Update template selector
     */
    updateTemplateSelector() {
        const selector = document.getElementById('reportTemplate');
        if (!selector) return;

        selector.innerHTML = '<option value="">Select Template...</option>';

        // Group by category
        const categories = new Map();
        this.templates.forEach(t => {
            const cat = t.category || 'Other';
            if (!categories.has(cat)) {
                categories.set(cat, []);
            }
            categories.get(cat).push(t);
        });

        categories.forEach((templates, category) => {
            const optgroup = document.createElement('optgroup');
            optgroup.label = category;
            templates.forEach(t => {
                const option = document.createElement('option');
                option.value = t.templateId;
                option.textContent = t.name;
                optgroup.appendChild(option);
            });
            selector.appendChild(optgroup);
        });
    }

    /**
     * Expand macro at cursor
     */
    expandMacro(textarea) {
        const cursorPos = textarea.selectionStart;
        const text = textarea.value;

        // Find word before cursor
        let wordStart = cursorPos;
        while (wordStart > 0 && /\w/.test(text[wordStart - 1])) {
            wordStart--;
        }

        const word = text.substring(wordStart, cursorPos);

        if (this.macros.has(word)) {
            const expansion = this.macros.get(word);
            textarea.value = text.substring(0, wordStart) + expansion + text.substring(cursorPos);
            textarea.selectionStart = textarea.selectionEnd = wordStart + expansion.length;
            this.autoExpandTextarea(textarea);
            this.markDirty();
        }
    }

    /**
     * Save report as draft
     */
    async saveDraft() {
        if (!this.currentReport) return;

        const data = this.getFormData();
        data.status = 'DRAFT';

        try {
            const url = this.currentReport.id
                ? `/api/reports/draft?id=${this.currentReport.id}`
                : '/api/reports/draft';

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.currentReport = await response.json();
                this.isDirty = false;
                document.getElementById('reportSaveStatus')?.classList.remove('unsaved');
                document.getElementById('reportSaveStatus').textContent =
                    `Saved ${new Date().toLocaleTimeString()}`;
            }
        } catch (error) {
            console.error('Error saving draft:', error);
        }
    }

    /**
     * Submit report for review
     */
    async submitForReview() {
        if (!this.validateReport()) {
            showToast('Please fill in required fields', 'warning');
            return;
        }

        const data = this.getFormData();
        data.status = 'PRELIMINARY';

        try {
            const url = this.currentReport.id
                ? `/api/reports/${this.currentReport.id}`
                : '/api/reports';

            const response = await fetch(url, {
                method: this.currentReport.id ? 'PUT' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });

            if (response.ok) {
                this.currentReport = await response.json();
                this.isDirty = false;
                showToast('Report submitted for review', 'success');
            }
        } catch (error) {
            console.error('Error submitting report:', error);
            showToast('Failed to submit report', 'error');
        }
    }

    /**
     * Sign and finalize report
     */
    async signReport() {
        if (!this.currentReport?.id) {
            showToast('Please save the report first', 'warning');
            return;
        }

        if (!this.validateReport()) {
            showToast('Please fill in required fields', 'warning');
            return;
        }

        const signedBy = document.getElementById('reportingPhysician')?.value;
        if (!signedBy) {
            showToast('Please enter reporting physician name', 'warning');
            return;
        }

        if (!confirm('Are you sure you want to sign and finalize this report? This action cannot be undone.')) {
            return;
        }

        try {
            const response = await fetch(`/api/reports/${this.currentReport.id}/sign`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    signedBy: signedBy,
                    digitalSignature: this.generateSignature(signedBy)
                })
            });

            if (response.ok) {
                this.currentReport = await response.json();
                this.populateForm(this.currentReport);
                showToast('Report signed and finalized', 'success');

                // Notify workflow manager
                if (typeof workflowManager !== 'undefined') {
                    workflowManager.linkReport(
                        this.currentReport.studyInstanceUid,
                        this.currentReport.id,
                        'FINAL'
                    );
                }
            }
        } catch (error) {
            console.error('Error signing report:', error);
            showToast('Failed to sign report', 'error');
        }
    }

    /**
     * Generate digital signature (placeholder)
     */
    generateSignature(signedBy) {
        const timestamp = new Date().toISOString();
        return btoa(`${signedBy}|${timestamp}|${this.currentReport.studyInstanceUid}`);
    }

    /**
     * Validate report
     */
    validateReport() {
        const findings = document.getElementById('findings')?.value;
        const impression = document.getElementById('impression')?.value;

        return findings?.trim().length > 0 && impression?.trim().length > 0;
    }

    /**
     * Export to PDF/Print
     */
    async exportToPdf() {
        if (!this.currentReport?.id) {
            await this.saveDraft();
        }

        try {
            const response = await fetch(`/api/reports/${this.currentReport.id}/print`);
            if (response.ok) {
                const html = await response.text();

                // Open in new window for printing
                const printWindow = window.open('', '_blank');
                printWindow.document.write(html);
                printWindow.document.close();
                printWindow.focus();

                // Auto-print after a short delay
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            }
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showToast('Failed to export PDF', 'error');
        }
    }

    /**
     * Export to DICOM SR
     */
    async exportToDicomSr(pacsNode = null) {
        if (!this.currentReport?.id) {
            await this.saveDraft();
        }

        try {
            const params = pacsNode ? `?pacsNode=${pacsNode}` : '';
            const response = await fetch(`/api/reports/${this.currentReport.id}/export-sr${params}`, {
                method: 'POST'
            });

            if (response.ok) {
                const result = await response.json();
                showToast('Exported as DICOM SR', 'success');
                return result;
            }
        } catch (error) {
            console.error('Error exporting to DICOM SR:', error);
            showToast('Failed to export DICOM SR', 'error');
        }
    }

    /**
     * Insert key image reference
     */
    insertKeyImage(sopInstanceUid, seriesInstanceUid, description = '') {
        if (!this.currentReport.keyImages) {
            this.currentReport.keyImages = [];
        }

        this.currentReport.keyImages.push({
            sopInstanceUid,
            seriesInstanceUid,
            frameNumber: viewportManager.getCurrentFrameNumber?.() || 0,
            description: description || `Key Image ${this.currentReport.keyImages.length + 1}`
        });

        this.markDirty();
        showToast('Key image added to report', 'success');
    }

    /**
     * Insert measurement from annotation
     */
    insertMeasurement(measurement) {
        if (!this.currentReport.measurements) {
            this.currentReport.measurements = [];
        }

        this.currentReport.measurements.push(measurement);

        // Also add to findings text
        const findingsEl = document.getElementById('findings');
        if (findingsEl) {
            const measurementText = `\n${measurement.label}: ${measurement.value} ${measurement.unit}`;
            findingsEl.value += measurementText;
            this.autoExpandTextarea(findingsEl);
        }

        this.markDirty();
    }

    /**
     * Show report editor panel
     */
    showReportEditor() {
        document.getElementById('reportEditorModal').style.display = 'flex';
    }

    /**
     * Hide report editor panel
     */
    hideReportEditor() {
        if (this.isDirty) {
            if (!confirm('You have unsaved changes. Discard?')) {
                return;
            }
        }
        document.getElementById('reportEditorModal').style.display = 'none';
    }

    /**
     * Auto-expand textarea
     */
    autoExpandTextarea(textarea) {
        textarea.style.height = 'auto';
        textarea.style.height = Math.max(60, textarea.scrollHeight) + 'px';
    }

    /**
     * Format date for display
     */
    formatDate(dateStr) {
        if (!dateStr) return '-';
        try {
            if (dateStr.length === 8) {
                return `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
            }
            return new Date(dateStr).toLocaleDateString();
        } catch {
            return dateStr;
        }
    }

    /**
     * Cleanup
     */
    destroy() {
        if (this.autosaveInterval) {
            clearInterval(this.autosaveInterval);
        }
    }
}

// Create global instance
const reportManager = new ReportManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    reportManager.initialize();
});

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (reportManager.isDirty) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes in the report.';
    }
});

