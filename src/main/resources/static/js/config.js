/**
 * Configuration for Raster PACS Viewer
 * Advanced Zero-Footprint DICOM Viewer with MPR and 3D Support
 */
const CONFIG = {
    // API endpoints
    API_BASE: '',
    DICOMWEB_BASE: '/dicomweb',
    WADO_URI: '/wado',

    // WebSocket
    WS_ENDPOINT: '/ws/stomp',

    // Default settings
    DEFAULT_WINDOW_LEVEL: {
        CT: { center: 40, width: 400 },
        MR: { center: 500, width: 1000 },
        CR: { center: 2048, width: 4096 },
        DX: { center: 2048, width: 4096 },
        US: { center: 128, width: 256 },
        PT: { center: 32767, width: 65535 },
        NM: { center: 32767, width: 65535 }
    },

    // Window/Level presets
    WL_PRESETS: {
        brain: { center: 40, width: 80, name: 'Brain', shortcut: '1' },
        subdural: { center: 75, width: 215, name: 'Subdural' },
        stroke: { center: 40, width: 40, name: 'Stroke' },
        lung: { center: -600, width: 1500, name: 'Lung', shortcut: '2' },
        mediastinum: { center: 50, width: 350, name: 'Mediastinum' },
        bone: { center: 300, width: 1500, name: 'Bone', shortcut: '3' },
        softTissue: { center: 40, width: 400, name: 'Soft Tissue' },
        abdomen: { center: 40, width: 350, name: 'Abdomen', shortcut: '4' },
        liver: { center: 60, width: 150, name: 'Liver', shortcut: '5' },
        spine: { center: 50, width: 250, name: 'Spine' },
        pelvis: { center: 40, width: 400, name: 'Pelvis' },
        angio: { center: 300, width: 600, name: 'Angio' },
        cardiac: { center: 40, width: 400, name: 'Cardiac' },
        temporal: { center: 600, width: 2800, name: 'Temporal Bone' },
        mammo: { center: 2048, width: 4096, name: 'Mammography' }
    },

    // Grayscale LUT presets
    GRAYSCALE_LUTS: {
        linear: { name: 'Linear', type: 'linear' },
        sigmoid: { name: 'Sigmoid', type: 'sigmoid', center: 0.5, width: 0.2 },
        log: { name: 'Logarithmic', type: 'log' },
        exp: { name: 'Exponential', type: 'exp' }
    },

    // Color maps for special imaging
    COLOR_MAPS: {
        hot: { name: 'Hot Iron' },
        cool: { name: 'Cool' },
        rainbow: { name: 'Rainbow' },
        pet: { name: 'PET' },
        fusion: { name: 'Fusion' }
    },

    // Thumbnail settings
    THUMBNAIL_SIZE: 128,

    // Cine settings
    DEFAULT_CINE_FPS: 15,
    MAX_CINE_FPS: 60,
    MIN_CINE_FPS: 1,
    CINE_LOOP_MODES: {
        loop: { name: 'Loop', description: 'Continuous loop' },
        bounce: { name: 'Bounce', description: 'Forward then backward' },
        once: { name: 'Once', description: 'Play once and stop' }
    },

    // Cache settings
    MAX_CACHE_SIZE_MB: 500,

    // Viewport settings
    MAX_VIEWPORTS: 9,
    DEFAULT_LAYOUT: { rows: 1, cols: 1 },

    // MPR settings
    MPR: {
        SLICE_THICKNESS: 1.0,
        INTERPOLATION: 'linear',
        CROSSHAIRS: {
            AXIAL_COLOR: '#00ff00',
            SAGITTAL_COLOR: '#ff0000',
            CORONAL_COLOR: '#0000ff'
        }
    },

    // 3D rendering settings
    RENDERING_3D: {
        QUALITY: 'high',
        SAMPLING_DISTANCE: 0.5,
        SHADING: true,
        AMBIENT: 0.2,
        DIFFUSE: 0.7,
        SPECULAR: 0.3
    },

    // Annotation settings
    ANNOTATIONS: {
        AUTO_SAVE_INTERVAL: 60000,  // Auto-save every minute
        MAX_UNDO_LEVELS: 50,
        DEFAULT_COLOR: '#ffff00',
        TEXT_SIZE: 14
    },

    // Measurement units
    UNITS: {
        LENGTH: 'mm',
        AREA: 'mm²',
        VOLUME: 'mm³',
        HU: 'HU'
    }
};

// Freeze config to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.WL_PRESETS);
Object.freeze(CONFIG.GRAYSCALE_LUTS);
Object.freeze(CONFIG.COLOR_MAPS);
Object.freeze(CONFIG.CINE_LOOP_MODES);
Object.freeze(CONFIG.DEFAULT_WINDOW_LEVEL);
Object.freeze(CONFIG.MPR);
Object.freeze(CONFIG.RENDERING_3D);
Object.freeze(CONFIG.ANNOTATIONS);
Object.freeze(CONFIG.UNITS);

// Export for ES modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = CONFIG;
}

