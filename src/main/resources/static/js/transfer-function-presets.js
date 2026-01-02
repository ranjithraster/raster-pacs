/**
 * Transfer Function Presets Manager
 * Manages color/opacity transfer functions for HU-based volume rendering.
 * Supports JSON format with import/export and VTK/3D Slicer compatibility.
 */

class TransferFunctionPresets {
    constructor() {
        this.presets = {};
        this.customPresets = {};
        this.storageKey = 'raster-pacs-tf-presets';

        // Initialize with built-in clinical presets
        this.initBuiltInPresets();

        // Load custom presets from localStorage
        this.loadCustomPresets();
    }

    /**
     * Initialize clinically-validated built-in presets
     */
    initBuiltInPresets() {
        this.presets = {
            // CT Presets
            'ct-bone': {
                name: 'CT Bone',
                description: 'High-density bone visualization',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: 150, r: 200, g: 180, b: 160 },
                    { hu: 300, r: 230, g: 210, b: 180 },
                    { hu: 500, r: 250, g: 240, b: 220 },
                    { hu: 1000, r: 255, g: 250, b: 240 },
                    { hu: 2000, r: 255, g: 255, b: 255 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: 100, opacity: 0 },
                    { hu: 200, opacity: 0.1 },
                    { hu: 400, opacity: 0.4 },
                    { hu: 700, opacity: 0.7 },
                    { hu: 1000, opacity: 0.9 },
                    { hu: 3071, opacity: 1.0 }
                ]
            },

            'ct-soft-tissue': {
                name: 'CT Soft Tissue',
                description: 'Muscles, organs, and soft tissue',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -200, r: 50, g: 30, b: 20 },
                    { hu: 0, r: 180, g: 100, b: 80 },
                    { hu: 50, r: 220, g: 150, b: 130 },
                    { hu: 100, r: 255, g: 200, b: 180 },
                    { hu: 200, r: 255, g: 220, b: 200 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -200, opacity: 0 },
                    { hu: -100, opacity: 0.05 },
                    { hu: 0, opacity: 0.15 },
                    { hu: 50, opacity: 0.3 },
                    { hu: 100, opacity: 0.2 },
                    { hu: 200, opacity: 0.1 },
                    { hu: 3071, opacity: 0 }
                ]
            },

            'ct-lung': {
                name: 'CT Lung',
                description: 'Lung parenchyma and airways',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 10, g: 30, b: 60 },
                    { hu: -900, r: 30, g: 80, b: 120 },
                    { hu: -700, r: 80, g: 140, b: 180 },
                    { hu: -500, r: 150, g: 190, b: 220 },
                    { hu: -200, r: 200, g: 220, b: 240 },
                    { hu: 0, r: 255, g: 200, b: 180 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0.1 },
                    { hu: -950, opacity: 0.15 },
                    { hu: -800, opacity: 0.3 },
                    { hu: -600, opacity: 0.4 },
                    { hu: -400, opacity: 0.2 },
                    { hu: -200, opacity: 0.05 },
                    { hu: 0, opacity: 0 },
                    { hu: 3071, opacity: 0 }
                ]
            },

            'ct-vascular': {
                name: 'CT Vascular (CTA)',
                description: 'Contrast-enhanced blood vessels',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: 50, r: 50, g: 20, b: 20 },
                    { hu: 150, r: 180, g: 50, b: 50 },
                    { hu: 250, r: 255, g: 100, b: 80 },
                    { hu: 400, r: 255, g: 180, b: 150 },
                    { hu: 600, r: 255, g: 230, b: 220 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: 50, opacity: 0 },
                    { hu: 100, opacity: 0.1 },
                    { hu: 200, opacity: 0.5 },
                    { hu: 350, opacity: 0.8 },
                    { hu: 500, opacity: 0.9 },
                    { hu: 3071, opacity: 1.0 }
                ]
            },

            'ct-cardiac': {
                name: 'CT Cardiac',
                description: 'Heart chambers and myocardium',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -50, r: 60, g: 30, b: 30 },
                    { hu: 50, r: 180, g: 60, b: 60 },
                    { hu: 150, r: 220, g: 100, b: 90 },
                    { hu: 300, r: 255, g: 160, b: 140 },
                    { hu: 500, r: 255, g: 220, b: 200 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -100, opacity: 0 },
                    { hu: 0, opacity: 0.15 },
                    { hu: 100, opacity: 0.4 },
                    { hu: 250, opacity: 0.6 },
                    { hu: 400, opacity: 0.3 },
                    { hu: 3071, opacity: 0 }
                ]
            },

            'ct-skin': {
                name: 'CT Skin Surface',
                description: 'External skin surface',
                modality: 'CT',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -500, r: 180, g: 140, b: 120 },
                    { hu: -200, r: 220, g: 180, b: 160 },
                    { hu: 0, r: 255, g: 220, b: 200 },
                    { hu: 100, r: 255, g: 230, b: 210 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -600, opacity: 0 },
                    { hu: -400, opacity: 0.3 },
                    { hu: -200, opacity: 0.7 },
                    { hu: 0, opacity: 0.3 },
                    { hu: 100, opacity: 0 },
                    { hu: 3071, opacity: 0 }
                ]
            },

            // MR Presets
            'mr-brain': {
                name: 'MR Brain',
                description: 'Brain tissue visualization',
                modality: 'MR',
                colorPoints: [
                    { hu: 0, r: 0, g: 0, b: 0 },
                    { hu: 200, r: 80, g: 80, b: 100 },
                    { hu: 400, r: 150, g: 150, b: 170 },
                    { hu: 600, r: 200, g: 200, b: 220 },
                    { hu: 800, r: 240, g: 240, b: 250 },
                    { hu: 1000, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: 0, opacity: 0 },
                    { hu: 100, opacity: 0.05 },
                    { hu: 300, opacity: 0.2 },
                    { hu: 500, opacity: 0.5 },
                    { hu: 700, opacity: 0.7 },
                    { hu: 1000, opacity: 0.9 }
                ]
            },

            // Projection modes (simple grayscale)
            'grayscale': {
                name: 'Grayscale',
                description: 'Simple grayscale mapping',
                modality: 'ALL',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: 0, r: 128, g: 128, b: 128 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -500, opacity: 0.1 },
                    { hu: 0, opacity: 0.5 },
                    { hu: 500, opacity: 0.8 },
                    { hu: 3071, opacity: 1.0 }
                ]
            },

            'hot-iron': {
                name: 'Hot Iron',
                description: 'Heat map colorization',
                modality: 'ALL',
                colorPoints: [
                    { hu: -1024, r: 0, g: 0, b: 0 },
                    { hu: -500, r: 40, g: 0, b: 0 },
                    { hu: 0, r: 180, g: 30, b: 0 },
                    { hu: 500, r: 255, g: 150, b: 0 },
                    { hu: 1500, r: 255, g: 255, b: 100 },
                    { hu: 3071, r: 255, g: 255, b: 255 }
                ],
                opacityPoints: [
                    { hu: -1024, opacity: 0 },
                    { hu: -500, opacity: 0.1 },
                    { hu: 0, opacity: 0.4 },
                    { hu: 500, opacity: 0.7 },
                    { hu: 3071, opacity: 1.0 }
                ]
            }
        };
    }

    /**
     * Load custom presets from localStorage
     */
    loadCustomPresets() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            if (stored) {
                this.customPresets = JSON.parse(stored);
                console.log(`Loaded ${Object.keys(this.customPresets).length} custom presets`);
            }
        } catch (e) {
            console.warn('Failed to load custom presets:', e);
            this.customPresets = {};
        }
    }

    /**
     * Save custom presets to localStorage
     */
    saveCustomPresets() {
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.customPresets));
        } catch (e) {
            console.error('Failed to save custom presets:', e);
        }
    }

    /**
     * Get a preset by ID
     */
    getPreset(id) {
        return this.presets[id] || this.customPresets[id] || null;
    }

    /**
     * Get all presets (built-in + custom)
     */
    getAllPresets() {
        return { ...this.presets, ...this.customPresets };
    }

    /**
     * Get presets filtered by modality
     */
    getPresetsByModality(modality) {
        const all = this.getAllPresets();
        return Object.fromEntries(
            Object.entries(all).filter(([, preset]) =>
                preset.modality === modality || preset.modality === 'ALL'
            )
        );
    }

    /**
     * Save a custom preset
     */
    saveCustomPreset(id, preset) {
        this.customPresets[id] = {
            ...preset,
            isCustom: true,
            createdAt: new Date().toISOString()
        };
        this.saveCustomPresets();
    }

    /**
     * Delete a custom preset
     */
    deleteCustomPreset(id) {
        if (this.customPresets[id]) {
            delete this.customPresets[id];
            this.saveCustomPresets();
            return true;
        }
        return false;
    }

    /**
     * Export preset to JSON
     */
    exportPresetToJSON(id) {
        const preset = this.getPreset(id);
        if (!preset) return null;

        return JSON.stringify({
            version: '1.0',
            type: 'raster-pacs-transfer-function',
            preset: { id, ...preset }
        }, null, 2);
    }

    /**
     * Export all custom presets to JSON
     */
    exportAllCustomPresetsToJSON() {
        return JSON.stringify({
            version: '1.0',
            type: 'raster-pacs-transfer-functions',
            presets: this.customPresets
        }, null, 2);
    }

    /**
     * Import preset from JSON
     */
    importPresetFromJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);

            if (data.type === 'raster-pacs-transfer-function' && data.preset) {
                const { id, ...preset } = data.preset;
                this.saveCustomPreset(id, preset);
                return { success: true, imported: 1 };
            }

            if (data.type === 'raster-pacs-transfer-functions' && data.presets) {
                let count = 0;
                for (const [id, preset] of Object.entries(data.presets)) {
                    this.saveCustomPreset(id, preset);
                    count++;
                }
                return { success: true, imported: count };
            }

            throw new Error('Invalid preset format');
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Import VTK XML color transfer function
     * Format: <ColorTransferFunction> with <Point x="" r="" g="" b=""/> nodes
     */
    importVTKColorTransferFunction(xmlString, name = 'Imported VTK') {
        try {
            const parser = new DOMParser();
            const doc = parser.parseFromString(xmlString, 'text/xml');

            const points = doc.querySelectorAll('Point');
            if (points.length === 0) {
                throw new Error('No Point elements found in VTK XML');
            }

            const colorPoints = [];
            const opacityPoints = [];

            points.forEach(point => {
                const x = parseFloat(point.getAttribute('x') || point.getAttribute('X') || 0);
                const r = parseFloat(point.getAttribute('r') || point.getAttribute('R') || 0) * 255;
                const g = parseFloat(point.getAttribute('g') || point.getAttribute('G') || 0) * 255;
                const b = parseFloat(point.getAttribute('b') || point.getAttribute('B') || 0) * 255;
                const o = parseFloat(point.getAttribute('o') || point.getAttribute('O') || 1);

                colorPoints.push({ hu: x, r: Math.round(r), g: Math.round(g), b: Math.round(b) });
                opacityPoints.push({ hu: x, opacity: o });
            });

            // Sort by HU value
            colorPoints.sort((a, b) => a.hu - b.hu);
            opacityPoints.sort((a, b) => a.hu - b.hu);

            const id = 'vtk-import-' + Date.now();
            this.saveCustomPreset(id, {
                name,
                description: 'Imported from VTK XML',
                modality: 'ALL',
                colorPoints,
                opacityPoints
            });

            return { success: true, id };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Import 3D Slicer color table (.ctbl)
     * Format: CSV with columns: value, red, green, blue, alpha, label
     */
    importSlicerColorTable(ctblString, name = 'Imported Slicer') {
        try {
            const lines = ctblString.split('\n').filter(line =>
                line.trim() && !line.startsWith('#')
            );

            const colorPoints = [];
            const opacityPoints = [];

            lines.forEach(line => {
                const parts = line.split(/[,\s]+/);
                if (parts.length >= 5) {
                    const value = parseFloat(parts[0]);
                    const r = parseInt(parts[1]);
                    const g = parseInt(parts[2]);
                    const b = parseInt(parts[3]);
                    const a = parseFloat(parts[4]);

                    colorPoints.push({ hu: value, r, g, b });
                    opacityPoints.push({ hu: value, opacity: a });
                }
            });

            if (colorPoints.length === 0) {
                throw new Error('No valid color entries found in Slicer color table');
            }

            // Sort by HU value
            colorPoints.sort((a, b) => a.hu - b.hu);
            opacityPoints.sort((a, b) => a.hu - b.hu);

            const id = 'slicer-import-' + Date.now();
            this.saveCustomPreset(id, {
                name,
                description: 'Imported from 3D Slicer color table',
                modality: 'ALL',
                colorPoints,
                opacityPoints
            });

            return { success: true, id };
        } catch (e) {
            return { success: false, error: e.message };
        }
    }

    /**
     * Create a linear preset between two HU values
     */
    createLinearPreset(name, huMin, huMax, colorStart, colorEnd) {
        const id = 'linear-' + Date.now();

        this.saveCustomPreset(id, {
            name,
            description: `Linear mapping from ${huMin} to ${huMax} HU`,
            modality: 'ALL',
            colorPoints: [
                { hu: huMin, ...colorStart },
                { hu: huMax, ...colorEnd }
            ],
            opacityPoints: [
                { hu: huMin, opacity: 0 },
                { hu: (huMin + huMax) / 2, opacity: 0.5 },
                { hu: huMax, opacity: 1.0 }
            ]
        });

        return id;
    }
}

// Create global instance
window.transferFunctionPresets = new TransferFunctionPresets();
window.TransferFunctionPresets = TransferFunctionPresets;

