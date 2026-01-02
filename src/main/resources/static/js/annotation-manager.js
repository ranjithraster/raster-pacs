/**
 * Annotation Manager
 * Handles DICOM annotations and saving to DICOM SR
 */

class AnnotationManager {
    constructor() {
        this.annotations = new Map();
        this.currentStudyUid = null;
        this.currentSeriesUid = null;
        this.unsavedChanges = false;
    }

    /**
     * Initialize annotation manager
     */
    initialize() {
        // Listen for annotation events from Cornerstone
        this.setupEventListeners();
        console.log('Annotation Manager initialized');
    }

    /**
     * Setup event listeners for annotation changes
     */
    setupEventListeners() {
        // Cornerstone annotation events
        if (window.cornerstoneTools) {
            const eventDispatcher = window.cornerstoneTools.eventTarget;

            eventDispatcher.addEventListener('ANNOTATION_COMPLETED', (event) => {
                this.handleAnnotationAdded(event.detail);
            });

            eventDispatcher.addEventListener('ANNOTATION_MODIFIED', (event) => {
                this.handleAnnotationModified(event.detail);
            });

            eventDispatcher.addEventListener('ANNOTATION_REMOVED', (event) => {
                this.handleAnnotationRemoved(event.detail);
            });
        }
    }

    /**
     * Handle new annotation added
     */
    handleAnnotationAdded(detail) {
        const annotation = detail.annotation;
        if (!annotation) return;

        const annotationData = this.convertToDTO(annotation);
        this.annotations.set(annotation.annotationUID, annotationData);
        this.unsavedChanges = true;

        this.updateAnnotationsList();
        console.log('Annotation added:', annotation.annotationUID);
    }

    /**
     * Handle annotation modified
     */
    handleAnnotationModified(detail) {
        const annotation = detail.annotation;
        if (!annotation) return;

        const annotationData = this.convertToDTO(annotation);
        this.annotations.set(annotation.annotationUID, annotationData);
        this.unsavedChanges = true;

        this.updateAnnotationsList();
    }

    /**
     * Handle annotation removed
     */
    handleAnnotationRemoved(detail) {
        const annotationUID = detail.annotationUID;
        this.annotations.delete(annotationUID);
        this.unsavedChanges = true;

        this.updateAnnotationsList();
    }

    /**
     * Convert Cornerstone annotation to DTO format
     */
    convertToDTO(annotation) {
        const metadata = annotation.metadata || {};
        const data = annotation.data || {};

        // Extract SOP Instance UID from referenced image ID
        let sopInstanceUid = '';
        if (metadata.referencedImageId) {
            const match = metadata.referencedImageId.match(/objectUID=([^&]+)/);
            if (match) {
                sopInstanceUid = match[1];
            }
        }

        // Calculate measurement value based on type
        let measurementValue = null;
        let label = annotation.label || '';

        switch (metadata.toolName) {
            case 'Length':
                measurementValue = data.cachedStats?.length;
                label = label || `Length: ${measurementValue?.toFixed(2)} mm`;
                break;
            case 'Angle':
                measurementValue = data.cachedStats?.angle;
                label = label || `Angle: ${measurementValue?.toFixed(1)}°`;
                break;
            case 'EllipticalROI':
            case 'CircleROI':
            case 'RectangleROI':
                measurementValue = data.cachedStats?.area;
                label = label || `Area: ${measurementValue?.toFixed(2)} mm²`;
                break;
            case 'Bidirectional':
                measurementValue = {
                    length: data.cachedStats?.length,
                    width: data.cachedStats?.width
                };
                label = label || `${measurementValue.length?.toFixed(2)} x ${measurementValue.width?.toFixed(2)} mm`;
                break;
        }

        return {
            annotationUID: annotation.annotationUID,
            studyInstanceUid: this.currentStudyUid,
            seriesInstanceUid: this.currentSeriesUid,
            sopInstanceUid: sopInstanceUid,
            frameNumber: metadata.frameNumber || 1,
            annotationType: metadata.toolName,
            data: JSON.stringify({
                handles: data.handles,
                cachedStats: data.cachedStats,
                label: data.label
            }),
            label: label,
            measurementValue: measurementValue,
            referencedImageId: metadata.referencedImageId,
            viewportId: metadata.viewportId
        };
    }

    /**
     * Set current study and series
     */
    setCurrentContext(studyUid, seriesUid) {
        this.currentStudyUid = studyUid;
        this.currentSeriesUid = seriesUid;
    }

    /**
     * Load annotations from server for current study
     */
    async loadAnnotations(studyUid, seriesUid = null) {
        try {
            let url = `/api/annotations/study/${studyUid}`;
            if (seriesUid) {
                url += `/series/${seriesUid}`;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const annotations = await response.json();

            // Clear current annotations
            this.annotations.clear();

            // Add loaded annotations
            annotations.forEach(ann => {
                this.annotations.set(ann.id?.toString(), ann);
            });

            this.updateAnnotationsList();
            this.unsavedChanges = false;

            console.log(`Loaded ${annotations.length} annotations`);
            return annotations;

        } catch (error) {
            console.error('Error loading annotations:', error);
            return [];
        }
    }

    /**
     * Save annotations to server
     */
    async saveAnnotations() {
        if (this.annotations.size === 0) {
            showToast('No annotations to save', 'warning');
            return;
        }

        try {
            const annotationsArray = Array.from(this.annotations.values());

            const response = await fetch('/api/annotations/batch', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(annotationsArray)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const saved = await response.json();

            // Update local annotations with server IDs
            saved.forEach(ann => {
                if (ann.annotationUID) {
                    this.annotations.set(ann.annotationUID, ann);
                }
            });

            this.unsavedChanges = false;
            showToast(`Saved ${saved.length} annotations`, 'success');
            return saved;

        } catch (error) {
            console.error('Error saving annotations:', error);
            showToast('Failed to save annotations', 'error');
            throw error;
        }
    }

    /**
     * Save annotations as DICOM SR
     */
    async saveAsDicomSR(storeToPacs = false, pacsNode = null) {
        if (this.annotations.size === 0) {
            showToast('No annotations to save', 'warning');
            return;
        }

        if (!this.currentStudyUid) {
            showToast('No study selected', 'error');
            return;
        }

        showToast('Creating DICOM SR...', 'info');

        try {
            const request = {
                studyInstanceUid: this.currentStudyUid,
                seriesInstanceUid: this.currentSeriesUid,
                annotations: Array.from(this.annotations.values()),
                pacsNode: storeToPacs ? pacsNode : null
            };

            const response = await fetch('/api/annotations/save-as-sr', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(request)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            // Mark annotations as saved
            this.annotations.forEach(ann => {
                ann.savedToSr = true;
                ann.srInstanceUid = result.srInstanceUid;
            });

            this.updateAnnotationsList();
            this.unsavedChanges = false;

            showToast('Annotations saved as DICOM SR', 'success');
            return result;

        } catch (error) {
            console.error('Error saving as DICOM SR:', error);
            showToast('Failed to create DICOM SR', 'error');
            throw error;
        }
    }

    /**
     * Delete an annotation
     */
    async deleteAnnotation(annotationUID) {
        const annotation = this.annotations.get(annotationUID);

        if (annotation?.id) {
            try {
                await fetch(`/api/annotations/${annotation.id}`, {
                    method: 'DELETE'
                });
            } catch (error) {
                console.error('Error deleting annotation from server:', error);
            }
        }

        this.annotations.delete(annotationUID);

        // Also remove from Cornerstone
        if (CornerstoneService?.clearAnnotation) {
            CornerstoneService.clearAnnotation(annotationUID);
        }

        this.updateAnnotationsList();
    }

    /**
     * Clear all annotations
     */
    clearAllAnnotations() {
        this.annotations.clear();

        // Clear from Cornerstone
        if (CornerstoneService?.clearAllAnnotations) {
            CornerstoneService.clearAllAnnotations();
        }

        this.updateAnnotationsList();
        this.unsavedChanges = true;
    }

    /**
     * Update the annotations list in the UI
     */
    updateAnnotationsList() {
        const listEl = document.getElementById('annotationsList');
        if (!listEl) return;

        if (this.annotations.size === 0) {
            listEl.innerHTML = '<div class="empty-state">No annotations</div>';
            return;
        }

        let html = '';
        this.annotations.forEach((ann, uid) => {
            const icon = this.getAnnotationIcon(ann.annotationType);
            const savedBadge = ann.savedToSr ?
                '<span class="badge badge-success">SR</span>' : '';

            html += `
                <div class="annotation-item" data-uid="${uid}">
                    <div class="annotation-icon">${icon}</div>
                    <div class="annotation-info">
                        <div class="annotation-type">${ann.annotationType || 'Unknown'}</div>
                        <div class="annotation-label">${ann.label || ''}</div>
                    </div>
                    ${savedBadge}
                    <button class="btn-icon" onclick="annotationManager.deleteAnnotation('${uid}')" title="Delete">
                        🗑
                    </button>
                </div>
            `;
        });

        listEl.innerHTML = html;

        // Add click handlers to jump to annotation
        listEl.querySelectorAll('.annotation-item').forEach(item => {
            item.addEventListener('click', (e) => {
                if (e.target.tagName === 'BUTTON') return;
                this.jumpToAnnotation(item.dataset.uid);
            });
        });
    }

    /**
     * Get icon for annotation type
     */
    getAnnotationIcon(type) {
        const icons = {
            'Length': '📏',
            'Angle': '📐',
            'EllipticalROI': '⭕',
            'RectangleROI': '⬜',
            'CircleROI': '⚫',
            'ArrowAnnotate': '➤',
            'Bidirectional': '↔',
            'Probe': '🎯',
            'CobbAngle': '📊',
            'PlanarFreehandROI': '✏️'
        };
        return icons[type] || '📍';
    }

    /**
     * Jump to annotation location
     */
    jumpToAnnotation(annotationUID) {
        const annotation = this.annotations.get(annotationUID);
        if (!annotation) return;

        // Try to get the image index from the referenced image
        if (annotation.referencedImageId) {
            const seriesData = viewportManager.loadedSeries.get(annotation.seriesInstanceUid);
            if (seriesData?.instances) {
                const index = seriesData.instances.findIndex(
                    inst => inst.sopInstanceUid === annotation.sopInstanceUid
                );
                if (index >= 0) {
                    viewportManager.jumpToImage(index);
                }
            }
        }
    }

    /**
     * Export annotations as JSON
     */
    exportAsJSON() {
        const annotations = Array.from(this.annotations.values());
        const json = JSON.stringify(annotations, null, 2);

        // Download as file
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `annotations_${this.currentStudyUid || 'export'}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    /**
     * Import annotations from JSON
     */
    async importFromJSON(file) {
        try {
            const text = await file.text();
            const annotations = JSON.parse(text);

            annotations.forEach(ann => {
                const uid = ann.annotationUID || `imported-${Date.now()}-${Math.random()}`;
                this.annotations.set(uid, ann);
            });

            this.updateAnnotationsList();
            this.unsavedChanges = true;

            showToast(`Imported ${annotations.length} annotations`, 'success');

        } catch (error) {
            console.error('Error importing annotations:', error);
            showToast('Failed to import annotations', 'error');
        }
    }

    /**
     * Check for unsaved changes
     */
    hasUnsavedChanges() {
        return this.unsavedChanges;
    }
}

// Create global instance
const annotationManager = new AnnotationManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    annotationManager.initialize();
});

// Warn before leaving with unsaved changes
window.addEventListener('beforeunload', (e) => {
    if (annotationManager.hasUnsavedChanges()) {
        e.preventDefault();
        e.returnValue = 'You have unsaved annotations. Are you sure you want to leave?';
    }
});

