/**
 * Segmentation Manager
 * Handles segmentation tools, brush/eraser, contours, and DICOM SEG export
 */

class SegmentationManager {
    constructor() {
        this.segments = new Map();
        this.activeSegmentId = null;
        this.activeTool = null;
        this.brushSize = 10;
        this.brushShape = 'circle'; // 'circle', 'square'
        this.isDrawing = false;
        this.currentStudyUid = null;
        this.currentSeriesUid = null;
        this.segmentColors = [
            '#FF0000', '#00FF00', '#0000FF', '#FFFF00', '#FF00FF', '#00FFFF',
            '#FF8000', '#8000FF', '#00FF80', '#FF0080', '#80FF00', '#0080FF'
        ];
        this.colorIndex = 0;
        this.undoStack = [];
        this.redoStack = [];
        this.maxUndoLevels = 50;
        this.maskCanvas = null;
        this.maskCtx = null;
    }

    /**
     * Initialize segmentation manager
     */
    initialize() {
        this.setupEventListeners();
        this.createMaskCanvas();
        console.log('Segmentation Manager initialized');
    }

    /**
     * Create off-screen canvas for mask drawing
     */
    createMaskCanvas() {
        this.maskCanvas = document.createElement('canvas');
        this.maskCtx = this.maskCanvas.getContext('2d');
    }

    /**
     * Set the current context
     */
    setContext(studyUid, seriesUid, rows, columns) {
        this.currentStudyUid = studyUid;
        this.currentSeriesUid = seriesUid;
        this.maskCanvas.width = columns;
        this.maskCanvas.height = rows;
        this.maskCtx.fillStyle = 'black';
        this.maskCtx.fillRect(0, 0, columns, rows);
    }

    /**
     * Create a new segment
     */
    createSegment(options = {}) {
        const id = `seg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const segment = {
            id: id,
            label: options.label || `Segment ${this.segments.size + 1}`,
            description: options.description || '',
            category: options.category || 'Organ',
            type: options.type || 'Tissue',
            color: options.color || this.getNextColor(),
            opacity: options.opacity || 0.5,
            visible: true,
            locked: false,
            masks: new Map(), // frameNumber -> ImageData
            volumeMm3: 0,
            createdAt: new Date(),
            modifiedAt: new Date()
        };

        this.segments.set(id, segment);
        this.activeSegmentId = id;
        this.updateSegmentsList();

        return segment;
    }

    /**
     * Get next color from palette
     */
    getNextColor() {
        const color = this.segmentColors[this.colorIndex % this.segmentColors.length];
        this.colorIndex++;
        return color;
    }

    /**
     * Delete a segment
     */
    deleteSegment(segmentId) {
        this.segments.delete(segmentId);
        if (this.activeSegmentId === segmentId) {
            this.activeSegmentId = this.segments.keys().next().value || null;
        }
        this.updateSegmentsList();
        this.renderSegmentations();
    }

    /**
     * Set active segment
     */
    setActiveSegment(segmentId) {
        this.activeSegmentId = segmentId;
        this.updateSegmentsList();
    }

    /**
     * Set active tool
     */
    setTool(toolName) {
        this.activeTool = toolName;

        // Update tool buttons
        document.querySelectorAll('.seg-tool-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.tool === toolName);
        });

        // Update cursor based on tool
        const viewportElement = document.querySelector('.viewport-element');
        if (viewportElement) {
            switch (toolName) {
                case 'brush':
                    viewportElement.style.cursor = 'crosshair';
                    break;
                case 'eraser':
                    viewportElement.style.cursor = 'crosshair';
                    break;
                case 'fill':
                    viewportElement.style.cursor = 'cell';
                    break;
                case 'polygon':
                    viewportElement.style.cursor = 'crosshair';
                    break;
                case 'threshold':
                    viewportElement.style.cursor = 'crosshair';
                    break;
                default:
                    viewportElement.style.cursor = 'default';
            }
        }

        console.log('Segmentation tool set to:', toolName);
    }

    /**
     * Set brush size
     */
    setBrushSize(size) {
        this.brushSize = Math.max(1, Math.min(100, size));
        document.getElementById('brushSizeLabel')?.textContent = `${this.brushSize}px`;
    }

    /**
     * Set brush shape
     */
    setBrushShape(shape) {
        this.brushShape = shape;
    }

    /**
     * Setup event listeners for drawing
     */
    setupEventListeners() {
        const viewportGrid = document.getElementById('viewportGrid');
        if (!viewportGrid) return;

        viewportGrid.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        viewportGrid.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        viewportGrid.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        viewportGrid.addEventListener('mouseleave', (e) => this.handleMouseUp(e));

        // Touch support
        viewportGrid.addEventListener('touchstart', (e) => this.handleTouchStart(e));
        viewportGrid.addEventListener('touchmove', (e) => this.handleTouchMove(e));
        viewportGrid.addEventListener('touchend', (e) => this.handleTouchEnd(e));
    }

    /**
     * Handle mouse down
     */
    handleMouseDown(e) {
        if (!this.activeTool || !this.activeSegmentId) return;

        const viewport = e.target.closest('.viewport-element');
        if (!viewport) return;

        this.isDrawing = true;
        this.saveUndoState();

        const point = this.getCanvasPoint(e, viewport);
        this.lastPoint = point;

        if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
            this.drawBrush(point.x, point.y);
        } else if (this.activeTool === 'fill') {
            this.floodFill(point.x, point.y);
        }
    }

    /**
     * Handle mouse move
     */
    handleMouseMove(e) {
        if (!this.isDrawing) return;

        const viewport = e.target.closest('.viewport-element');
        if (!viewport) return;

        const point = this.getCanvasPoint(e, viewport);

        if (this.activeTool === 'brush' || this.activeTool === 'eraser') {
            // Draw line from last point to current point
            this.drawLine(this.lastPoint.x, this.lastPoint.y, point.x, point.y);
            this.lastPoint = point;
        }
    }

    /**
     * Handle mouse up
     */
    handleMouseUp(e) {
        if (this.isDrawing) {
            this.isDrawing = false;
            this.saveCurrentMask();
            this.renderSegmentations();
        }
    }

    /**
     * Handle touch events
     */
    handleTouchStart(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseDown({ target: e.target, clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchMove(e) {
        e.preventDefault();
        const touch = e.touches[0];
        this.handleMouseMove({ target: e.target, clientX: touch.clientX, clientY: touch.clientY });
    }

    handleTouchEnd(e) {
        this.handleMouseUp(e);
    }

    /**
     * Get canvas point from mouse event
     */
    getCanvasPoint(e, viewport) {
        const rect = viewport.getBoundingClientRect();
        const scaleX = this.maskCanvas.width / rect.width;
        const scaleY = this.maskCanvas.height / rect.height;

        return {
            x: Math.floor((e.clientX - rect.left) * scaleX),
            y: Math.floor((e.clientY - rect.top) * scaleY)
        };
    }

    /**
     * Draw brush at point
     */
    drawBrush(x, y) {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        if (this.activeTool === 'eraser') {
            this.maskCtx.globalCompositeOperation = 'destination-out';
            this.maskCtx.fillStyle = 'white';
        } else {
            this.maskCtx.globalCompositeOperation = 'source-over';
            this.maskCtx.fillStyle = segment.color;
        }

        this.maskCtx.beginPath();
        if (this.brushShape === 'circle') {
            this.maskCtx.arc(x, y, this.brushSize / 2, 0, Math.PI * 2);
        } else {
            const half = this.brushSize / 2;
            this.maskCtx.rect(x - half, y - half, this.brushSize, this.brushSize);
        }
        this.maskCtx.fill();
    }

    /**
     * Draw line between two points
     */
    drawLine(x1, y1, x2, y2) {
        const dist = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
        const steps = Math.max(1, Math.ceil(dist / (this.brushSize / 4)));

        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            const x = x1 + (x2 - x1) * t;
            const y = y1 + (y2 - y1) * t;
            this.drawBrush(x, y);
        }
    }

    /**
     * Flood fill at point
     */
    floodFill(startX, startY) {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        const width = this.maskCanvas.width;
        const height = this.maskCanvas.height;
        const imageData = this.maskCtx.getImageData(0, 0, width, height);
        const data = imageData.data;

        // Get target color
        const startIdx = (startY * width + startX) * 4;
        const targetR = data[startIdx];
        const targetG = data[startIdx + 1];
        const targetB = data[startIdx + 2];
        const targetA = data[startIdx + 3];

        // Parse fill color
        const fillColor = this.hexToRgb(segment.color);

        // Check if already filled with this color
        if (targetR === fillColor.r && targetG === fillColor.g &&
            targetB === fillColor.b && targetA === 255) {
            return;
        }

        const stack = [[startX, startY]];
        const visited = new Set();

        while (stack.length > 0) {
            const [x, y] = stack.pop();

            if (x < 0 || x >= width || y < 0 || y >= height) continue;

            const key = `${x},${y}`;
            if (visited.has(key)) continue;
            visited.add(key);

            const idx = (y * width + x) * 4;

            if (data[idx] !== targetR || data[idx + 1] !== targetG ||
                data[idx + 2] !== targetB || data[idx + 3] !== targetA) {
                continue;
            }

            // Fill pixel
            data[idx] = fillColor.r;
            data[idx + 1] = fillColor.g;
            data[idx + 2] = fillColor.b;
            data[idx + 3] = 255;

            // Add neighbors
            stack.push([x + 1, y], [x - 1, y], [x, y + 1], [x, y - 1]);
        }

        this.maskCtx.putImageData(imageData, 0, 0);
    }

    /**
     * Apply threshold segmentation
     */
    applyThreshold(minValue, maxValue) {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        // Get pixel data from viewport
        const viewport = viewportManager.getActiveViewport();
        if (!viewport) return;

        // This would need integration with Cornerstone to get pixel values
        // For now, this is a placeholder
        showToast('Threshold segmentation requires active image data', 'info');
    }

    /**
     * Region growing segmentation
     */
    regionGrow(seedX, seedY, tolerance) {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        // Similar to flood fill but with intensity tolerance
        showToast('Region growing started', 'info');
    }

    /**
     * Save current mask state for undo
     */
    saveUndoState() {
        const imageData = this.maskCtx.getImageData(
            0, 0, this.maskCanvas.width, this.maskCanvas.height);

        this.undoStack.push({
            segmentId: this.activeSegmentId,
            imageData: imageData,
            frameNumber: this.getCurrentFrameNumber()
        });

        if (this.undoStack.length > this.maxUndoLevels) {
            this.undoStack.shift();
        }

        this.redoStack = [];
    }

    /**
     * Undo last action
     */
    undo() {
        if (this.undoStack.length === 0) return;

        const current = this.maskCtx.getImageData(
            0, 0, this.maskCanvas.width, this.maskCanvas.height);
        this.redoStack.push({
            segmentId: this.activeSegmentId,
            imageData: current,
            frameNumber: this.getCurrentFrameNumber()
        });

        const state = this.undoStack.pop();
        this.maskCtx.putImageData(state.imageData, 0, 0);
        this.renderSegmentations();

        showToast('Undo', 'info');
    }

    /**
     * Redo last undone action
     */
    redo() {
        if (this.redoStack.length === 0) return;

        const current = this.maskCtx.getImageData(
            0, 0, this.maskCanvas.width, this.maskCanvas.height);
        this.undoStack.push({
            segmentId: this.activeSegmentId,
            imageData: current,
            frameNumber: this.getCurrentFrameNumber()
        });

        const state = this.redoStack.pop();
        this.maskCtx.putImageData(state.imageData, 0, 0);
        this.renderSegmentations();

        showToast('Redo', 'info');
    }

    /**
     * Save current mask to segment
     */
    saveCurrentMask() {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        const frameNumber = this.getCurrentFrameNumber();
        const imageData = this.maskCtx.getImageData(
            0, 0, this.maskCanvas.width, this.maskCanvas.height);

        segment.masks.set(frameNumber, imageData);
        segment.modifiedAt = new Date();
    }

    /**
     * Load mask for frame
     */
    loadMaskForFrame(frameNumber) {
        const segment = this.segments.get(this.activeSegmentId);
        if (!segment) return;

        const mask = segment.masks.get(frameNumber);
        if (mask) {
            this.maskCtx.putImageData(mask, 0, 0);
        } else {
            this.maskCtx.fillStyle = 'black';
            this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        }

        this.renderSegmentations();
    }

    /**
     * Get current frame number
     */
    getCurrentFrameNumber() {
        const viewport = viewportManager.getActiveViewport();
        if (viewport && typeof viewport.getCurrentImageIdIndex === 'function') {
            return viewport.getCurrentImageIdIndex();
        }
        return 0;
    }

    /**
     * Render segmentations on viewport
     */
    renderSegmentations() {
        const viewportElements = document.querySelectorAll('.viewport-element');

        viewportElements.forEach((element, index) => {
            let overlay = element.querySelector('.segmentation-overlay');
            if (!overlay) {
                overlay = document.createElement('canvas');
                overlay.className = 'segmentation-overlay';
                overlay.style.cssText = 'position: absolute; top: 0; left: 0; width: 100%; height: 100%; pointer-events: none;';
                element.appendChild(overlay);
            }

            overlay.width = element.offsetWidth;
            overlay.height = element.offsetHeight;
            const ctx = overlay.getContext('2d');
            ctx.clearRect(0, 0, overlay.width, overlay.height);

            // Draw all visible segments
            this.segments.forEach((segment, segmentId) => {
                if (!segment.visible) return;

                const frameNumber = this.getCurrentFrameNumber();
                const mask = segment.masks.get(frameNumber);

                if (mask) {
                    // Create temporary canvas for segment mask
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = mask.width;
                    tempCanvas.height = mask.height;
                    const tempCtx = tempCanvas.getContext('2d');
                    tempCtx.putImageData(mask, 0, 0);

                    // Draw with opacity
                    ctx.globalAlpha = segment.opacity;
                    ctx.drawImage(tempCanvas, 0, 0, overlay.width, overlay.height);
                    ctx.globalAlpha = 1.0;
                }
            });

            // Draw active segment's current drawing
            if (this.activeSegmentId) {
                const segment = this.segments.get(this.activeSegmentId);
                if (segment && segment.visible) {
                    ctx.globalAlpha = segment.opacity;
                    ctx.drawImage(this.maskCanvas, 0, 0, overlay.width, overlay.height);
                    ctx.globalAlpha = 1.0;
                }
            }
        });
    }

    /**
     * Toggle segment visibility
     */
    toggleSegmentVisibility(segmentId) {
        const segment = this.segments.get(segmentId);
        if (segment) {
            segment.visible = !segment.visible;
            this.updateSegmentsList();
            this.renderSegmentations();
        }
    }

    /**
     * Update segments list in UI
     */
    updateSegmentsList() {
        const listEl = document.getElementById('segmentsList');
        if (!listEl) return;

        if (this.segments.size === 0) {
            listEl.innerHTML = '<div class="empty-state">No segments</div>';
            return;
        }

        let html = '';
        this.segments.forEach((segment, id) => {
            const isActive = id === this.activeSegmentId;
            html += `
                <div class="segment-item ${isActive ? 'active' : ''}" data-id="${id}">
                    <div class="segment-color" style="background: ${segment.color}; opacity: ${segment.opacity}"></div>
                    <div class="segment-info" onclick="segmentationManager.setActiveSegment('${id}')">
                        <div class="segment-label">${segment.label}</div>
                        <div class="segment-type">${segment.type}</div>
                    </div>
                    <div class="segment-actions">
                        <button class="btn-icon" onclick="segmentationManager.toggleSegmentVisibility('${id}')" 
                                title="${segment.visible ? 'Hide' : 'Show'}">
                            ${segment.visible ? '👁' : '👁‍🗨'}
                        </button>
                        <button class="btn-icon" onclick="segmentationManager.deleteSegment('${id}')" title="Delete">
                            🗑
                        </button>
                    </div>
                </div>
            `;
        });

        listEl.innerHTML = html;
    }

    /**
     * Save all segments to server
     */
    async saveToServer() {
        if (this.segments.size === 0) {
            showToast('No segments to save', 'warning');
            return;
        }

        showToast('Saving segments...', 'info');

        try {
            const savedIds = [];

            for (const [id, segment] of this.segments) {
                const dto = await this.segmentToDto(segment);

                const response = await fetch('/api/segmentations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(dto)
                });

                if (response.ok) {
                    const saved = await response.json();
                    savedIds.push(saved.id);
                }
            }

            showToast(`Saved ${savedIds.length} segments`, 'success');
            return savedIds;
        } catch (error) {
            console.error('Error saving segments:', error);
            showToast('Failed to save segments', 'error');
            throw error;
        }
    }

    /**
     * Export to DICOM SEG
     */
    async exportToDicomSeg(pacsNode = null) {
        try {
            // First save to server
            const savedIds = await this.saveToServer();

            if (!savedIds || savedIds.length === 0) {
                showToast('No segments to export', 'warning');
                return;
            }

            showToast('Exporting to DICOM SEG...', 'info');

            const response = await fetch('/api/segmentations/export-seg', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    segmentationIds: savedIds,
                    pacsNode: pacsNode
                })
            });

            if (response.ok) {
                const result = await response.json();
                showToast(`Exported as DICOM SEG: ${result.segSopInstanceUid}`, 'success');
                return result;
            } else {
                throw new Error('Export failed');
            }
        } catch (error) {
            console.error('Error exporting to DICOM SEG:', error);
            showToast('Failed to export DICOM SEG', 'error');
        }
    }

    /**
     * Convert segment to DTO for API
     */
    async segmentToDto(segment) {
        const frameMasks = [];

        for (const [frameNumber, imageData] of segment.masks) {
            const encoded = this.encodeImageData(imageData);
            frameMasks.push({
                frameNumber: frameNumber,
                sopInstanceUid: this.getSopInstanceUidForFrame(frameNumber),
                encodedMask: encoded,
                encoding: 'RLE'
            });
        }

        return {
            studyInstanceUid: this.currentStudyUid,
            referencedSeriesUid: this.currentSeriesUid,
            segmentLabel: segment.label,
            segmentDescription: segment.description,
            segmentCategory: segment.category,
            segmentType: segment.type,
            segmentColor: segment.color,
            segmentOpacity: segment.opacity,
            segmentAlgorithmType: 'MANUAL',
            segmentNumber: Array.from(this.segments.keys()).indexOf(segment.id) + 1,
            rows: this.maskCanvas.height,
            columns: this.maskCanvas.width,
            totalFrames: segment.masks.size,
            frameMasks: frameMasks
        };
    }

    /**
     * Encode ImageData to base64 RLE
     */
    encodeImageData(imageData) {
        const data = imageData.data;
        const mask = new Uint8Array(imageData.width * imageData.height);

        // Extract mask (non-zero alpha means segment)
        for (let i = 0; i < mask.length; i++) {
            mask[i] = data[i * 4 + 3] > 0 ? 1 : 0;
        }

        // RLE encode
        const rle = this.rleEncode(mask);
        return btoa(String.fromCharCode.apply(null, rle));
    }

    /**
     * RLE encode binary mask
     */
    rleEncode(data) {
        const encoded = [];
        let count = 1;
        let current = data[0];

        for (let i = 1; i < data.length; i++) {
            if (data[i] === current && count < 255) {
                count++;
            } else {
                encoded.push(count, current);
                current = data[i];
                count = 1;
            }
        }
        encoded.push(count, current);

        return new Uint8Array(encoded);
    }

    /**
     * Get SOP Instance UID for frame
     */
    getSopInstanceUidForFrame(frameNumber) {
        const seriesData = viewportManager.loadedSeries.get(this.currentSeriesUid);
        if (seriesData?.instances && seriesData.instances[frameNumber]) {
            return seriesData.instances[frameNumber].sopInstanceUid;
        }
        return null;
    }

    /**
     * Load segments from server
     */
    async loadFromServer(studyUid, seriesUid) {
        try {
            const response = await fetch(`/api/segmentations/study/${studyUid}/series/${seriesUid}`);
            if (!response.ok) return;

            const segmentations = await response.json();

            for (const seg of segmentations) {
                // Load full segment with masks
                const fullResponse = await fetch(`/api/segmentations/${seg.id}`);
                if (fullResponse.ok) {
                    const fullSeg = await fullResponse.json();
                    this.importSegmentation(fullSeg);
                }
            }

            this.updateSegmentsList();
            this.renderSegmentations();

            showToast(`Loaded ${segmentations.length} segments`, 'success');
        } catch (error) {
            console.error('Error loading segments:', error);
        }
    }

    /**
     * Import segmentation from DTO
     */
    importSegmentation(dto) {
        const segment = this.createSegment({
            label: dto.segmentLabel,
            description: dto.segmentDescription,
            category: dto.segmentCategory,
            type: dto.segmentType,
            color: dto.segmentColor,
            opacity: dto.segmentOpacity
        });

        if (dto.frameMasks) {
            for (const frameMask of dto.frameMasks) {
                const imageData = this.decodeMask(frameMask, dto.columns, dto.rows);
                segment.masks.set(frameMask.frameNumber, imageData);
            }
        }
    }

    /**
     * Decode mask from DTO
     */
    decodeMask(frameMask, width, height) {
        const imageData = new ImageData(width, height);

        try {
            const decoded = atob(frameMask.encodedMask);
            const bytes = new Uint8Array(decoded.length);
            for (let i = 0; i < decoded.length; i++) {
                bytes[i] = decoded.charCodeAt(i);
            }

            let mask;
            if (frameMask.encoding === 'RLE') {
                mask = this.rleDecode(bytes, width * height);
            } else {
                mask = bytes;
            }

            // Apply mask to image data with color
            const segment = this.segments.get(this.activeSegmentId);
            const color = segment ? this.hexToRgb(segment.color) : { r: 255, g: 0, b: 0 };

            for (let i = 0; i < mask.length; i++) {
                if (mask[i]) {
                    imageData.data[i * 4] = color.r;
                    imageData.data[i * 4 + 1] = color.g;
                    imageData.data[i * 4 + 2] = color.b;
                    imageData.data[i * 4 + 3] = 255;
                }
            }
        } catch (e) {
            console.error('Failed to decode mask:', e);
        }

        return imageData;
    }

    /**
     * RLE decode
     */
    rleDecode(encoded, outputSize) {
        const decoded = new Uint8Array(outputSize);
        let outIdx = 0;

        for (let i = 0; i < encoded.length - 1; i += 2) {
            const count = encoded[i];
            const value = encoded[i + 1];

            for (let j = 0; j < count && outIdx < outputSize; j++) {
                decoded[outIdx++] = value;
            }
        }

        return decoded;
    }

    /**
     * Clear all segments
     */
    clearAll() {
        if (this.segments.size > 0 &&
            !confirm('Are you sure you want to clear all segments?')) {
            return;
        }

        this.segments.clear();
        this.activeSegmentId = null;
        this.maskCtx.fillStyle = 'black';
        this.maskCtx.fillRect(0, 0, this.maskCanvas.width, this.maskCanvas.height);
        this.updateSegmentsList();
        this.renderSegmentations();

        showToast('All segments cleared', 'info');
    }

    /**
     * Helper: hex to RGB
     */
    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 255, g: 0, b: 0 };
    }
}

// Create global instance
const segmentationManager = new SegmentationManager();

// Initialize when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    segmentationManager.initialize();
});

