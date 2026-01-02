/**
 * Measurement Manager
 * Comprehensive measurement and annotation tools for DICOM viewer
 * Features:
 * - Linear measurements (distance)
 * - Angle measurements
 * - ROI measurements (ellipse, rectangle, circle, freehand)
 * - Area, perimeter, and pixel value (HU) calculations
 * - Text annotations and arrows
 * - Distance calibration
 * - Lesion tracking
 * - Measurement comparison across studies
 */

class MeasurementManager {
    constructor() {
        this.measurements = new Map(); // id -> measurement object
        this.activeTool = null;
        this.isDrawing = false;
        this.currentMeasurement = null;
        this.selectedMeasurement = null;
        this.canvas = null;
        this.ctx = null;
        this.viewportElement = null;
        this.pixelSpacing = { x: 1, y: 1 }; // mm per pixel
        this.calibrationFactor = 1.0;
        this.measurementCounter = 0;
        this.lesionTracking = new Map(); // lesionId -> array of measurements across studies
        this.undoStack = [];
        this.redoStack = [];

        // Styles
        this.styles = {
            default: {
                color: '#00ff00',
                lineWidth: 2,
                fontSize: 12,
                fontFamily: 'Arial'
            },
            selected: {
                color: '#ffff00',
                lineWidth: 3
            },
            hover: {
                color: '#00ffff',
                lineWidth: 2
            }
        };
    }

    /**
     * Initialize measurement manager for a viewport
     */
    initialize(viewportElement, pixelSpacing = null) {
        this.viewportElement = viewportElement;

        if (pixelSpacing) {
            this.pixelSpacing = pixelSpacing;
        }

        // Create measurement canvas overlay
        this.createCanvas();

        // Setup event listeners
        this.setupEventListeners();

        console.log('MeasurementManager initialized');
    }

    /**
     * Create canvas overlay for measurements
     */
    createCanvas() {
        // Remove existing canvas if any
        const existingCanvas = this.viewportElement.querySelector('.measurement-canvas');
        if (existingCanvas) {
            existingCanvas.remove();
        }

        this.canvas = document.createElement('canvas');
        this.canvas.className = 'measurement-canvas';
        this.canvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 100;
        `;

        this.viewportElement.style.position = 'relative';
        this.viewportElement.appendChild(this.canvas);

        this.ctx = this.canvas.getContext('2d');
        this.resizeCanvas();

        // Handle resize
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    /**
     * Resize canvas to match viewport
     */
    resizeCanvas() {
        if (!this.canvas || !this.viewportElement) return;

        const rect = this.viewportElement.getBoundingClientRect();
        this.canvas.width = rect.width;
        this.canvas.height = rect.height;
        this.render();
    }

    /**
     * Setup event listeners for drawing
     */
    setupEventListeners() {
        // We need pointer events on the viewport, not the canvas
        this.viewportElement.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.viewportElement.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.viewportElement.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.viewportElement.addEventListener('dblclick', (e) => this.onDoubleClick(e));
        this.viewportElement.addEventListener('contextmenu', (e) => this.onContextMenu(e));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => this.onKeyDown(e));
    }

    /**
     * Set active measurement tool
     */
    setTool(toolName) {
        this.activeTool = toolName;
        // Canvas remains pointer-events: none since we capture events on viewportElement

        // Update cursor
        if (toolName) {
            this.viewportElement.style.cursor = 'crosshair';
        } else {
            this.viewportElement.style.cursor = 'default';
        }

        console.log('Measurement tool set:', toolName);
    }

    /**
     * Get mouse position relative to canvas
     */
    getMousePos(e) {
        // Use viewportElement rect since events come from the viewport, not the canvas
        const rect = this.viewportElement.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    /**
     * Mouse down handler
     */
    onMouseDown(e) {
        if (!this.activeTool) return;
        if (e.button !== 0) return; // Only left click

        const pos = this.getMousePos(e);

        // Check if clicking on existing measurement
        const clicked = this.findMeasurementAt(pos);
        if (clicked && !this.isDrawing) {
            this.selectMeasurement(clicked.id);
            return;
        }

        this.isDrawing = true;
        this.startMeasurement(pos);
        e.preventDefault();
        e.stopPropagation();
    }

    /**
     * Mouse move handler
     */
    onMouseMove(e) {
        const pos = this.getMousePos(e);

        if (this.isDrawing && this.currentMeasurement) {
            this.updateMeasurement(pos);
            this.render();
        } else {
            // Hover effect
            const hovered = this.findMeasurementAt(pos);
            this.measurements.forEach(m => m.hovered = false);
            if (hovered) {
                hovered.hovered = true;
                this.viewportElement.style.cursor = 'pointer';
            } else if (this.activeTool) {
                this.viewportElement.style.cursor = 'crosshair';
            }
            this.render();
        }
    }

    /**
     * Mouse up handler
     */
    onMouseUp(e) {
        if (!this.isDrawing) return;

        const pos = this.getMousePos(e);

        if (this.currentMeasurement) {
            this.finalizeMeasurement(pos);
        }

        this.isDrawing = false;
        this.render();
    }

    /**
     * Double click handler for text annotations
     */
    onDoubleClick(e) {
        if (this.activeTool === 'text') {
            const pos = this.getMousePos(e);
            this.createTextAnnotation(pos);
        }
    }

    /**
     * Context menu handler
     */
    onContextMenu(e) {
        const pos = this.getMousePos(e);
        const clicked = this.findMeasurementAt(pos);

        if (clicked) {
            e.preventDefault();
            this.showMeasurementContextMenu(clicked, e.clientX, e.clientY);
        }
    }

    /**
     * Keyboard handler
     */
    onKeyDown(e) {
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedMeasurement) {
                this.deleteMeasurement(this.selectedMeasurement);
            }
        } else if (e.key === 'Escape') {
            this.cancelCurrentMeasurement();
        } else if (e.ctrlKey && e.key === 'z') {
            this.undo();
        } else if (e.ctrlKey && e.key === 'y') {
            this.redo();
        }
    }

    /**
     * Start a new measurement
     */
    startMeasurement(pos) {
        const id = `measurement-${++this.measurementCounter}`;

        switch (this.activeTool) {
            case 'length':
                this.currentMeasurement = {
                    id,
                    type: 'length',
                    startPoint: { ...pos },
                    endPoint: { ...pos },
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'angle':
                this.currentMeasurement = {
                    id,
                    type: 'angle',
                    points: [{ ...pos }],
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'ellipse':
            case 'roi':
                this.currentMeasurement = {
                    id,
                    type: 'ellipse',
                    center: { ...pos },
                    radiusX: 0,
                    radiusY: 0,
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'rectangle':
                this.currentMeasurement = {
                    id,
                    type: 'rectangle',
                    startPoint: { ...pos },
                    endPoint: { ...pos },
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'circle':
                this.currentMeasurement = {
                    id,
                    type: 'circle',
                    center: { ...pos },
                    radius: 0,
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'freehand':
                this.currentMeasurement = {
                    id,
                    type: 'freehand',
                    points: [{ ...pos }],
                    closed: false,
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'arrow':
                this.currentMeasurement = {
                    id,
                    type: 'arrow',
                    startPoint: { ...pos },
                    endPoint: { ...pos },
                    label: '',
                    color: this.styles.default.color
                };
                break;

            case 'probe':
                this.currentMeasurement = {
                    id,
                    type: 'probe',
                    point: { ...pos },
                    value: this.getPixelValue(pos),
                    label: '',
                    color: this.styles.default.color
                };
                this.finalizeMeasurement(pos);
                break;
        }
    }

    /**
     * Update current measurement while drawing
     */
    updateMeasurement(pos) {
        if (!this.currentMeasurement) return;

        switch (this.currentMeasurement.type) {
            case 'length':
            case 'arrow':
                this.currentMeasurement.endPoint = { ...pos };
                break;

            case 'angle':
                if (this.currentMeasurement.points.length < 3) {
                    this.currentMeasurement.points[this.currentMeasurement.points.length - 1] = { ...pos };
                }
                break;

            case 'ellipse':
                const dx = pos.x - this.currentMeasurement.center.x;
                const dy = pos.y - this.currentMeasurement.center.y;
                this.currentMeasurement.radiusX = Math.abs(dx);
                this.currentMeasurement.radiusY = Math.abs(dy);
                break;

            case 'rectangle':
                this.currentMeasurement.endPoint = { ...pos };
                break;

            case 'circle':
                const dist = Math.sqrt(
                    Math.pow(pos.x - this.currentMeasurement.center.x, 2) +
                    Math.pow(pos.y - this.currentMeasurement.center.y, 2)
                );
                this.currentMeasurement.radius = dist;
                break;

            case 'freehand':
                this.currentMeasurement.points.push({ ...pos });
                break;
        }

        // Calculate measurements
        this.calculateMeasurement(this.currentMeasurement);
    }

    /**
     * Finalize measurement
     */
    finalizeMeasurement(pos) {
        if (!this.currentMeasurement) return;

        // Special handling for angle (needs 3 points)
        if (this.currentMeasurement.type === 'angle') {
            if (this.currentMeasurement.points.length < 3) {
                this.currentMeasurement.points.push({ ...pos });
                if (this.currentMeasurement.points.length < 3) {
                    return; // Need more points
                }
            }
        }

        // Close freehand ROI
        if (this.currentMeasurement.type === 'freehand') {
            this.currentMeasurement.closed = true;
        }

        // Final calculation
        this.calculateMeasurement(this.currentMeasurement);

        // Add to measurements
        this.measurements.set(this.currentMeasurement.id, this.currentMeasurement);

        // Add to undo stack
        this.undoStack.push({
            action: 'add',
            measurement: { ...this.currentMeasurement }
        });
        this.redoStack = [];

        this.currentMeasurement = null;
        this.isDrawing = false;

        // Emit event
        this.emitMeasurementEvent('added');
    }

    /**
     * Calculate measurement values
     */
    calculateMeasurement(m) {
        const cal = this.calibrationFactor;
        const px = this.pixelSpacing.x * cal;
        const py = this.pixelSpacing.y * cal;

        switch (m.type) {
            case 'length':
            case 'arrow':
                const dx = (m.endPoint.x - m.startPoint.x) * px;
                const dy = (m.endPoint.y - m.startPoint.y) * py;
                m.distance = Math.sqrt(dx * dx + dy * dy);
                m.label = `${m.distance.toFixed(2)} mm`;
                break;

            case 'angle':
                if (m.points.length >= 3) {
                    const angle = this.calculateAngle(m.points[0], m.points[1], m.points[2]);
                    m.angle = angle;
                    m.label = `${angle.toFixed(1)}°`;
                }
                break;

            case 'ellipse':
                const a = m.radiusX * px;
                const b = m.radiusY * py;
                m.area = Math.PI * a * b;
                m.perimeter = Math.PI * (3 * (a + b) - Math.sqrt((3 * a + b) * (a + 3 * b)));
                m.meanHU = this.calculateMeanHU(m);
                m.label = `Area: ${m.area.toFixed(2)} mm²\nMean: ${m.meanHU?.toFixed(1) || 'N/A'} HU`;
                break;

            case 'rectangle':
                const width = Math.abs(m.endPoint.x - m.startPoint.x) * px;
                const height = Math.abs(m.endPoint.y - m.startPoint.y) * py;
                m.area = width * height;
                m.perimeter = 2 * (width + height);
                m.meanHU = this.calculateMeanHU(m);
                m.label = `Area: ${m.area.toFixed(2)} mm²\nMean: ${m.meanHU?.toFixed(1) || 'N/A'} HU`;
                break;

            case 'circle':
                const r = m.radius * px;
                m.area = Math.PI * r * r;
                m.perimeter = 2 * Math.PI * r;
                m.meanHU = this.calculateMeanHU(m);
                m.label = `Area: ${m.area.toFixed(2)} mm²\nMean: ${m.meanHU?.toFixed(1) || 'N/A'} HU`;
                break;

            case 'freehand':
                if (m.closed && m.points.length >= 3) {
                    m.area = this.calculatePolygonArea(m.points) * px * py;
                    m.perimeter = this.calculatePolygonPerimeter(m.points) * px;
                    m.meanHU = this.calculateMeanHU(m);
                    m.label = `Area: ${m.area.toFixed(2)} mm²\nMean: ${m.meanHU?.toFixed(1) || 'N/A'} HU`;
                }
                break;

            case 'probe':
                m.label = `${m.value?.toFixed(1) || 'N/A'} HU`;
                break;
        }
    }

    /**
     * Calculate angle between three points
     */
    calculateAngle(p1, p2, p3) {
        const v1 = { x: p1.x - p2.x, y: p1.y - p2.y };
        const v2 = { x: p3.x - p2.x, y: p3.y - p2.y };

        const dot = v1.x * v2.x + v1.y * v2.y;
        const mag1 = Math.sqrt(v1.x * v1.x + v1.y * v1.y);
        const mag2 = Math.sqrt(v2.x * v2.x + v2.y * v2.y);

        const cosAngle = dot / (mag1 * mag2);
        const angle = Math.acos(Math.max(-1, Math.min(1, cosAngle)));

        return angle * (180 / Math.PI);
    }

    /**
     * Calculate polygon area using shoelace formula
     */
    calculatePolygonArea(points) {
        let area = 0;
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            area += points[i].x * points[j].y;
            area -= points[j].x * points[i].y;
        }

        return Math.abs(area / 2);
    }

    /**
     * Calculate polygon perimeter
     */
    calculatePolygonPerimeter(points) {
        let perimeter = 0;
        const n = points.length;

        for (let i = 0; i < n; i++) {
            const j = (i + 1) % n;
            const dx = points[j].x - points[i].x;
            const dy = points[j].y - points[i].y;
            perimeter += Math.sqrt(dx * dx + dy * dy);
        }

        return perimeter;
    }

    /**
     * Get pixel value (HU) at a point
     */
    getPixelValue(pos) {
        // This would need to access the actual image data
        // For now, return a placeholder
        // In real implementation, this would read from the DICOM pixel data
        return null;
    }

    /**
     * Calculate mean HU value within ROI
     */
    calculateMeanHU(m) {
        // This would need to access actual image data and calculate mean within ROI
        // Placeholder implementation
        return null;
    }

    /**
     * Render all measurements
     */
    render() {
        if (!this.ctx) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // Render completed measurements
        this.measurements.forEach(m => this.renderMeasurement(m));

        // Render current measurement being drawn
        if (this.currentMeasurement) {
            this.renderMeasurement(this.currentMeasurement);
        }
    }

    /**
     * Render a single measurement
     */
    renderMeasurement(m) {
        const ctx = this.ctx;
        const style = m.selected ? this.styles.selected :
                      m.hovered ? this.styles.hover :
                      this.styles.default;

        ctx.strokeStyle = m.color || style.color;
        ctx.fillStyle = m.color || style.color;
        ctx.lineWidth = style.lineWidth;
        ctx.font = `${this.styles.default.fontSize}px ${this.styles.default.fontFamily}`;

        switch (m.type) {
            case 'length':
                this.renderLine(m.startPoint, m.endPoint, m.label);
                break;

            case 'angle':
                this.renderAngle(m);
                break;

            case 'ellipse':
                this.renderEllipse(m);
                break;

            case 'rectangle':
                this.renderRectangle(m);
                break;

            case 'circle':
                this.renderCircle(m);
                break;

            case 'freehand':
                this.renderFreehand(m);
                break;

            case 'arrow':
                this.renderArrow(m);
                break;

            case 'probe':
                this.renderProbe(m);
                break;

            case 'text':
                this.renderText(m);
                break;
        }
    }

    /**
     * Render line measurement
     */
    renderLine(start, end, label) {
        const ctx = this.ctx;

        // Draw line
        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();

        // Draw endpoints
        this.renderHandle(start);
        this.renderHandle(end);

        // Draw label
        if (label) {
            const midX = (start.x + end.x) / 2;
            const midY = (start.y + end.y) / 2;
            this.renderLabel(label, midX, midY - 10);
        }
    }

    /**
     * Render angle measurement
     */
    renderAngle(m) {
        const ctx = this.ctx;
        const points = m.points;

        if (points.length < 2) return;

        // Draw lines
        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);
        ctx.lineTo(points[1].x, points[1].y);
        if (points.length >= 3) {
            ctx.lineTo(points[2].x, points[2].y);
        }
        ctx.stroke();

        // Draw handles
        points.forEach(p => this.renderHandle(p));

        // Draw arc and label
        if (points.length >= 3) {
            const arcRadius = 30;
            const angle1 = Math.atan2(points[0].y - points[1].y, points[0].x - points[1].x);
            const angle2 = Math.atan2(points[2].y - points[1].y, points[2].x - points[1].x);

            ctx.beginPath();
            ctx.arc(points[1].x, points[1].y, arcRadius, angle1, angle2);
            ctx.stroke();

            // Label at vertex
            if (m.label) {
                this.renderLabel(m.label, points[1].x + 20, points[1].y - 20);
            }
        }
    }

    /**
     * Render ellipse ROI
     */
    renderEllipse(m) {
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.ellipse(m.center.x, m.center.y, m.radiusX, m.radiusY, 0, 0, 2 * Math.PI);
        ctx.stroke();

        // Semi-transparent fill
        ctx.fillStyle = ctx.strokeStyle.replace(')', ', 0.1)').replace('rgb', 'rgba');
        ctx.fill();

        // Handles
        this.renderHandle({ x: m.center.x - m.radiusX, y: m.center.y });
        this.renderHandle({ x: m.center.x + m.radiusX, y: m.center.y });
        this.renderHandle({ x: m.center.x, y: m.center.y - m.radiusY });
        this.renderHandle({ x: m.center.x, y: m.center.y + m.radiusY });

        // Label
        if (m.label) {
            this.renderMultilineLabel(m.label, m.center.x, m.center.y);
        }
    }

    /**
     * Render rectangle ROI
     */
    renderRectangle(m) {
        const ctx = this.ctx;
        const x = Math.min(m.startPoint.x, m.endPoint.x);
        const y = Math.min(m.startPoint.y, m.endPoint.y);
        const w = Math.abs(m.endPoint.x - m.startPoint.x);
        const h = Math.abs(m.endPoint.y - m.startPoint.y);

        ctx.strokeRect(x, y, w, h);

        // Semi-transparent fill
        ctx.fillStyle = ctx.strokeStyle.replace(')', ', 0.1)').replace('rgb', 'rgba');
        ctx.fillRect(x, y, w, h);

        // Handles at corners
        this.renderHandle(m.startPoint);
        this.renderHandle(m.endPoint);
        this.renderHandle({ x: m.startPoint.x, y: m.endPoint.y });
        this.renderHandle({ x: m.endPoint.x, y: m.startPoint.y });

        // Label
        if (m.label) {
            this.renderMultilineLabel(m.label, x + w / 2, y + h / 2);
        }
    }

    /**
     * Render circle ROI
     */
    renderCircle(m) {
        const ctx = this.ctx;

        ctx.beginPath();
        ctx.arc(m.center.x, m.center.y, m.radius, 0, 2 * Math.PI);
        ctx.stroke();

        // Semi-transparent fill
        ctx.fillStyle = ctx.strokeStyle.replace(')', ', 0.1)').replace('rgb', 'rgba');
        ctx.fill();

        // Label
        if (m.label) {
            this.renderMultilineLabel(m.label, m.center.x, m.center.y);
        }
    }

    /**
     * Render freehand ROI
     */
    renderFreehand(m) {
        const ctx = this.ctx;
        const points = m.points;

        if (points.length < 2) return;

        ctx.beginPath();
        ctx.moveTo(points[0].x, points[0].y);

        for (let i = 1; i < points.length; i++) {
            ctx.lineTo(points[i].x, points[i].y);
        }

        if (m.closed) {
            ctx.closePath();
            // Semi-transparent fill
            ctx.fillStyle = ctx.strokeStyle.replace(')', ', 0.1)').replace('rgb', 'rgba');
            ctx.fill();
        }

        ctx.stroke();

        // Label at centroid
        if (m.label && m.closed) {
            const centroid = this.calculateCentroid(points);
            this.renderMultilineLabel(m.label, centroid.x, centroid.y);
        }
    }

    /**
     * Render arrow annotation
     */
    renderArrow(m) {
        const ctx = this.ctx;
        const headLength = 15;
        const headAngle = Math.PI / 6;

        const angle = Math.atan2(m.endPoint.y - m.startPoint.y, m.endPoint.x - m.startPoint.x);

        // Draw line
        ctx.beginPath();
        ctx.moveTo(m.startPoint.x, m.startPoint.y);
        ctx.lineTo(m.endPoint.x, m.endPoint.y);
        ctx.stroke();

        // Draw arrowhead
        ctx.beginPath();
        ctx.moveTo(m.endPoint.x, m.endPoint.y);
        ctx.lineTo(
            m.endPoint.x - headLength * Math.cos(angle - headAngle),
            m.endPoint.y - headLength * Math.sin(angle - headAngle)
        );
        ctx.lineTo(
            m.endPoint.x - headLength * Math.cos(angle + headAngle),
            m.endPoint.y - headLength * Math.sin(angle + headAngle)
        );
        ctx.closePath();
        ctx.fill();

        // Label
        if (m.label) {
            this.renderLabel(m.label, m.startPoint.x, m.startPoint.y - 10);
        }
    }

    /**
     * Render probe (point measurement)
     */
    renderProbe(m) {
        const ctx = this.ctx;

        // Draw crosshair
        const size = 10;
        ctx.beginPath();
        ctx.moveTo(m.point.x - size, m.point.y);
        ctx.lineTo(m.point.x + size, m.point.y);
        ctx.moveTo(m.point.x, m.point.y - size);
        ctx.lineTo(m.point.x, m.point.y + size);
        ctx.stroke();

        // Label
        if (m.label) {
            this.renderLabel(m.label, m.point.x + 15, m.point.y - 5);
        }
    }

    /**
     * Render text annotation
     */
    renderText(m) {
        const ctx = this.ctx;

        ctx.fillStyle = m.color || this.styles.default.color;
        ctx.font = `${m.fontSize || 14}px ${this.styles.default.fontFamily}`;
        ctx.fillText(m.text, m.point.x, m.point.y);
    }

    /**
     * Render a handle point
     */
    renderHandle(point) {
        const ctx = this.ctx;
        const size = 4;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = ctx.strokeStyle;
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.rect(point.x - size, point.y - size, size * 2, size * 2);
        ctx.fill();
        ctx.stroke();
    }

    /**
     * Render label with background
     */
    renderLabel(text, x, y) {
        const ctx = this.ctx;
        const padding = 4;
        const metrics = ctx.measureText(text);
        const height = this.styles.default.fontSize;

        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(
            x - padding,
            y - height - padding,
            metrics.width + padding * 2,
            height + padding * 2
        );

        // Text
        ctx.fillStyle = '#ffffff';
        ctx.fillText(text, x, y);
    }

    /**
     * Render multiline label
     */
    renderMultilineLabel(text, x, y) {
        const lines = text.split('\n');
        const lineHeight = this.styles.default.fontSize + 4;
        const startY = y - (lines.length * lineHeight) / 2;

        lines.forEach((line, i) => {
            this.renderLabel(line, x - this.ctx.measureText(line).width / 2, startY + i * lineHeight);
        });
    }

    /**
     * Calculate centroid of polygon
     */
    calculateCentroid(points) {
        let sumX = 0, sumY = 0;
        points.forEach(p => {
            sumX += p.x;
            sumY += p.y;
        });
        return {
            x: sumX / points.length,
            y: sumY / points.length
        };
    }

    /**
     * Find measurement at position
     */
    findMeasurementAt(pos) {
        const threshold = 10;

        for (const [id, m] of this.measurements) {
            if (this.isPointNearMeasurement(pos, m, threshold)) {
                return m;
            }
        }
        return null;
    }

    /**
     * Check if point is near measurement
     */
    isPointNearMeasurement(pos, m, threshold) {
        switch (m.type) {
            case 'length':
            case 'arrow':
                return this.isPointNearLine(pos, m.startPoint, m.endPoint, threshold);

            case 'angle':
                for (let i = 0; i < m.points.length - 1; i++) {
                    if (this.isPointNearLine(pos, m.points[i], m.points[i + 1], threshold)) {
                        return true;
                    }
                }
                return false;

            case 'ellipse':
                const dx = (pos.x - m.center.x) / m.radiusX;
                const dy = (pos.y - m.center.y) / m.radiusY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                return Math.abs(dist - 1) < threshold / Math.max(m.radiusX, m.radiusY);

            case 'rectangle':
                return this.isPointInRect(pos, m.startPoint, m.endPoint);

            case 'circle':
                const circDist = Math.sqrt(
                    Math.pow(pos.x - m.center.x, 2) + Math.pow(pos.y - m.center.y, 2)
                );
                return Math.abs(circDist - m.radius) < threshold;

            case 'freehand':
                return this.isPointInPolygon(pos, m.points);

            case 'probe':
            case 'text':
                return Math.abs(pos.x - m.point.x) < threshold && Math.abs(pos.y - m.point.y) < threshold;
        }
        return false;
    }

    /**
     * Check if point is near line segment
     */
    isPointNearLine(point, lineStart, lineEnd, threshold) {
        const A = point.x - lineStart.x;
        const B = point.y - lineStart.y;
        const C = lineEnd.x - lineStart.x;
        const D = lineEnd.y - lineStart.y;

        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        let param = -1;

        if (lenSq !== 0) param = dot / lenSq;

        let xx, yy;

        if (param < 0) {
            xx = lineStart.x;
            yy = lineStart.y;
        } else if (param > 1) {
            xx = lineEnd.x;
            yy = lineEnd.y;
        } else {
            xx = lineStart.x + param * C;
            yy = lineStart.y + param * D;
        }

        const dx = point.x - xx;
        const dy = point.y - yy;
        return Math.sqrt(dx * dx + dy * dy) < threshold;
    }

    /**
     * Check if point is in rectangle
     */
    isPointInRect(point, start, end) {
        const minX = Math.min(start.x, end.x);
        const maxX = Math.max(start.x, end.x);
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);

        return point.x >= minX && point.x <= maxX && point.y >= minY && point.y <= maxY;
    }

    /**
     * Check if point is in polygon
     */
    isPointInPolygon(point, polygon) {
        let inside = false;
        const n = polygon.length;

        for (let i = 0, j = n - 1; i < n; j = i++) {
            const xi = polygon[i].x, yi = polygon[i].y;
            const xj = polygon[j].x, yj = polygon[j].y;

            if (((yi > point.y) !== (yj > point.y)) &&
                (point.x < (xj - xi) * (point.y - yi) / (yj - yi) + xi)) {
                inside = !inside;
            }
        }

        return inside;
    }

    /**
     * Select a measurement
     */
    selectMeasurement(id) {
        this.measurements.forEach(m => m.selected = false);

        const m = this.measurements.get(id);
        if (m) {
            m.selected = true;
            this.selectedMeasurement = id;
        }

        this.render();
    }

    /**
     * Delete a measurement
     */
    deleteMeasurement(id) {
        const m = this.measurements.get(id);
        if (m) {
            this.undoStack.push({
                action: 'delete',
                measurement: { ...m }
            });
            this.redoStack = [];

            this.measurements.delete(id);
            this.selectedMeasurement = null;
            this.render();
            this.emitMeasurementEvent('deleted');
        }
    }

    /**
     * Cancel current measurement
     */
    cancelCurrentMeasurement() {
        this.currentMeasurement = null;
        this.isDrawing = false;
        this.render();
    }

    /**
     * Create text annotation
     */
    createTextAnnotation(pos) {
        const text = prompt('Enter annotation text:');
        if (!text) return;

        const id = `measurement-${++this.measurementCounter}`;
        const m = {
            id,
            type: 'text',
            point: { ...pos },
            text,
            fontSize: 14,
            color: this.styles.default.color
        };

        this.measurements.set(id, m);
        this.undoStack.push({ action: 'add', measurement: { ...m } });
        this.redoStack = [];
        this.render();
    }

    /**
     * Show context menu for measurement
     */
    showMeasurementContextMenu(measurement, x, y) {
        // Remove existing menu
        const existing = document.querySelector('.measurement-context-menu');
        if (existing) existing.remove();

        const menu = document.createElement('div');
        menu.className = 'measurement-context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${x}px;
            top: ${y}px;
            background: #2a2a3e;
            border: 1px solid #444;
            border-radius: 4px;
            padding: 4px 0;
            z-index: 1000;
            min-width: 150px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5);
        `;

        const menuItems = [
            { label: '📋 Copy Value', action: () => this.copyMeasurementValue(measurement) },
            { label: '🏷️ Add Label', action: () => this.addMeasurementLabel(measurement) },
            { label: '🎨 Change Color', action: () => this.changeMeasurementColor(measurement) },
            { label: '📍 Track Lesion', action: () => this.trackLesion(measurement) },
            { label: '🗑️ Delete', action: () => this.deleteMeasurement(measurement.id) }
        ];

        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.textContent = item.label;
            menuItem.style.cssText = `
                padding: 8px 16px;
                cursor: pointer;
                color: #eee;
                font-size: 13px;
            `;
            menuItem.addEventListener('mouseenter', () => menuItem.style.background = '#3a3a4e');
            menuItem.addEventListener('mouseleave', () => menuItem.style.background = 'transparent');
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });

        document.body.appendChild(menu);

        // Close on click outside
        setTimeout(() => {
            document.addEventListener('click', function closeMenu() {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }, { once: true });
        }, 100);
    }

    /**
     * Copy measurement value to clipboard
     */
    copyMeasurementValue(m) {
        let value = '';
        switch (m.type) {
            case 'length':
            case 'arrow':
                value = `${m.distance?.toFixed(2)} mm`;
                break;
            case 'angle':
                value = `${m.angle?.toFixed(1)}°`;
                break;
            case 'ellipse':
            case 'rectangle':
            case 'circle':
            case 'freehand':
                value = `Area: ${m.area?.toFixed(2)} mm², Perimeter: ${m.perimeter?.toFixed(2)} mm`;
                break;
            case 'probe':
                value = `${m.value} HU`;
                break;
        }

        navigator.clipboard.writeText(value);
        showToast('Copied', value, 'success');
    }

    /**
     * Add custom label to measurement
     */
    addMeasurementLabel(m) {
        const customLabel = prompt('Enter custom label:', m.customLabel || '');
        if (customLabel !== null) {
            m.customLabel = customLabel;
            this.render();
        }
    }

    /**
     * Change measurement color
     */
    changeMeasurementColor(m) {
        const colors = ['#00ff00', '#ff0000', '#00ffff', '#ffff00', '#ff00ff', '#ffffff'];
        const currentIndex = colors.indexOf(m.color);
        m.color = colors[(currentIndex + 1) % colors.length];
        this.render();
    }

    /**
     * Track lesion across studies
     */
    trackLesion(m) {
        const lesionId = prompt('Enter lesion ID:', m.lesionId || `lesion-${this.lesionTracking.size + 1}`);
        if (!lesionId) return;

        m.lesionId = lesionId;

        if (!this.lesionTracking.has(lesionId)) {
            this.lesionTracking.set(lesionId, []);
        }

        this.lesionTracking.get(lesionId).push({
            measurementId: m.id,
            studyDate: window.appState?.currentStudy?.studyDate,
            value: m.distance || m.area,
            type: m.type
        });

        showToast('Lesion Tracked', `Added to ${lesionId}`, 'success');
    }

    /**
     * Get lesion comparison data
     */
    getLesionComparison(lesionId) {
        return this.lesionTracking.get(lesionId) || [];
    }

    /**
     * Set calibration factor
     */
    setCalibration(factor) {
        this.calibrationFactor = factor;
        // Recalculate all measurements
        this.measurements.forEach(m => this.calculateMeasurement(m));
        this.render();
    }

    /**
     * Set pixel spacing from DICOM metadata
     */
    setPixelSpacing(spacing) {
        this.pixelSpacing = spacing;
        // Recalculate all measurements
        this.measurements.forEach(m => this.calculateMeasurement(m));
        this.render();
    }

    /**
     * Undo last action
     */
    undo() {
        const action = this.undoStack.pop();
        if (!action) return;

        if (action.action === 'add') {
            this.measurements.delete(action.measurement.id);
        } else if (action.action === 'delete') {
            this.measurements.set(action.measurement.id, action.measurement);
        }

        this.redoStack.push(action);
        this.render();
    }

    /**
     * Redo last undone action
     */
    redo() {
        const action = this.redoStack.pop();
        if (!action) return;

        if (action.action === 'add') {
            this.measurements.set(action.measurement.id, action.measurement);
        } else if (action.action === 'delete') {
            this.measurements.delete(action.measurement.id);
        }

        this.undoStack.push(action);
        this.render();
    }

    /**
     * Clear all measurements
     */
    clearAll() {
        this.undoStack.push({
            action: 'clear',
            measurements: Array.from(this.measurements.values())
        });
        this.measurements.clear();
        this.render();
        this.emitMeasurementEvent('cleared');
    }

    /**
     * Export measurements as JSON
     */
    exportMeasurements() {
        const data = {
            measurements: Array.from(this.measurements.values()),
            lesionTracking: Array.from(this.lesionTracking.entries()),
            pixelSpacing: this.pixelSpacing,
            calibrationFactor: this.calibrationFactor
        };
        return JSON.stringify(data, null, 2);
    }

    /**
     * Import measurements from JSON
     */
    importMeasurements(json) {
        try {
            const data = JSON.parse(json);

            data.measurements.forEach(m => {
                this.measurements.set(m.id, m);
            });

            if (data.lesionTracking) {
                data.lesionTracking.forEach(([id, tracking]) => {
                    this.lesionTracking.set(id, tracking);
                });
            }

            if (data.pixelSpacing) {
                this.pixelSpacing = data.pixelSpacing;
            }

            if (data.calibrationFactor) {
                this.calibrationFactor = data.calibrationFactor;
            }

            this.render();
            return true;
        } catch (e) {
            console.error('Failed to import measurements:', e);
            return false;
        }
    }

    /**
     * Get measurements summary for report
     */
    getMeasurementsSummary() {
        const summary = {
            count: this.measurements.size,
            byType: {},
            lesions: []
        };

        this.measurements.forEach(m => {
            if (!summary.byType[m.type]) {
                summary.byType[m.type] = [];
            }
            summary.byType[m.type].push({
                id: m.id,
                value: m.distance || m.area || m.angle,
                label: m.label,
                customLabel: m.customLabel,
                lesionId: m.lesionId
            });
        });

        this.lesionTracking.forEach((tracking, id) => {
            summary.lesions.push({
                id,
                measurements: tracking
            });
        });

        return summary;
    }

    /**
     * Emit measurement event
     */
    emitMeasurementEvent(type) {
        const event = new CustomEvent('measurementChange', {
            detail: {
                type,
                count: this.measurements.size,
                summary: this.getMeasurementsSummary()
            }
        });
        document.dispatchEvent(event);
    }
}

// Create global instance
window.measurementManager = new MeasurementManager();

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = MeasurementManager;
}

