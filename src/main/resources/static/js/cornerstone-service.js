/**
 * Cornerstone3D Advanced Initialization
 * Handles loading and configuring the DICOM rendering library with MPR and 3D support
 */

// Module imports will be available when using Vite build
let cornerstoneCore = null;
let cornerstoneTools = null;
let cornerstoneDICOMImageLoader = null;
let dicomParser = null;

let isInitialized = false;
let renderingEngineId = 'rasterPacsRenderingEngine';
let renderingEngine = null;
let toolGroupManager = null;

// Viewport type constants
const ViewportType = {
    STACK: 'stack',
    ORTHOGRAPHIC: 'orthographic',
    VOLUME_3D: 'volume3d'
};

// Tool names
const ToolNames = {
    WindowLevel: 'WindowLevel',
    Pan: 'Pan',
    Zoom: 'Zoom',
    StackScroll: 'StackScrollMouseWheel',
    Length: 'Length',
    Angle: 'Angle',
    EllipticalROI: 'EllipticalROI',
    RectangleROI: 'RectangleROI',
    CircleROI: 'CircleROI',
    ArrowAnnotate: 'ArrowAnnotate',
    Bidirectional: 'Bidirectional',
    CobbAngle: 'CobbAngle',
    PlanarFreehandROI: 'PlanarFreehandROI',
    Probe: 'Probe',
    Crosshairs: 'Crosshairs',
    SegmentationDisplay: 'SegmentationDisplay',
    TrackballRotate: 'TrackballRotateTool',
    VolumeRotateMouseWheel: 'VolumeRotateMouseWheel'
};

/**
 * Initialize Cornerstone3D with all features
 */
async function initCornerstoneAdvanced() {
    if (isInitialized) {
        console.log('Cornerstone3D already initialized');
        return true;
    }

    console.log('Initializing Cornerstone3D Advanced...');

    try {
        // Try to use ES modules (Vite build)
        if (typeof window.cornerstone3D !== 'undefined') {
            cornerstoneCore = window.cornerstone3D;
            cornerstoneTools = window.cornerstone3DTools;
            cornerstoneDICOMImageLoader = window.cornerstone3DDICOMImageLoader;
            dicomParser = window.dicomParser;
        } else {
            // Fallback to CDN-loaded globals
            cornerstoneCore = window.cornerstone;
            cornerstoneTools = window.cornerstoneTools;
            cornerstoneDICOMImageLoader = window.cornerstoneDICOMImageLoader;
            dicomParser = window.dicomParser;
        }

        if (!cornerstoneCore) {
            console.warn('Cornerstone3D not found, using fallback renderer');
            return initFallbackRenderer();
        }

        // Initialize cornerstone core
        await cornerstoneCore.init();
        console.log('Cornerstone core initialized');

        // Initialize cornerstone tools
        if (cornerstoneTools) {
            await cornerstoneTools.init();
            console.log('Cornerstone tools initialized');

            // Add all tools
            addTools();
        }

        // Configure DICOM Image Loader
        if (cornerstoneDICOMImageLoader && dicomParser) {
            configureImageLoader();
        }

        // Create rendering engine
        renderingEngine = new cornerstoneCore.RenderingEngine(renderingEngineId);

        isInitialized = true;
        console.log('Cornerstone3D Advanced initialized successfully');
        return true;

    } catch (error) {
        console.error('Failed to initialize Cornerstone3D:', error);
        return initFallbackRenderer();
    }
}

/**
 * Configure the DICOM image loader
 */
function configureImageLoader() {
    // External dependencies
    cornerstoneDICOMImageLoader.external.cornerstone = cornerstoneCore;
    cornerstoneDICOMImageLoader.external.dicomParser = dicomParser;

    // Configure web workers
    const config = {
        maxWebWorkers: navigator.hardwareConcurrency || 4,
        startWebWorkersOnDemand: true,
        taskConfiguration: {
            decodeTask: {
                initializeCodecsOnStartup: true,
                strict: false
            }
        }
    };

    cornerstoneDICOMImageLoader.webWorkerManager.initialize(config);

    // Configure image loader options
    cornerstoneDICOMImageLoader.configure({
        beforeSend: function(xhr) {
            // Add auth headers if needed
        },
        errorInterceptor: function(error) {
            console.error('Image loader error:', error);
        }
    });

    // Register the DICOM image loader
    cornerstoneCore.registerImageLoader('wadouri', cornerstoneDICOMImageLoader.wadouri.loadImage);
    cornerstoneCore.registerImageLoader('wadors', cornerstoneDICOMImageLoader.wadors.loadImage);

    console.log('DICOM image loader configured');
}

/**
 * Add all measurement and annotation tools
 */
function addTools() {
    const {
        WindowLevelTool,
        PanTool,
        ZoomTool,
        StackScrollMouseWheelTool,
        LengthTool,
        AngleTool,
        EllipticalROITool,
        RectangleROITool,
        CircleROITool,
        ArrowAnnotateTool,
        BidirectionalTool,
        CobbAngleTool,
        PlanarFreehandROITool,
        ProbeTool,
        CrosshairsTool,
        SegmentationDisplayTool,
        TrackballRotateTool,
        VolumeRotateMouseWheelTool,
        MIPJumpToClickTool,
        ToolGroupManager: TGM
    } = cornerstoneTools;

    toolGroupManager = TGM;

    // Add tools
    cornerstoneTools.addTool(WindowLevelTool);
    cornerstoneTools.addTool(PanTool);
    cornerstoneTools.addTool(ZoomTool);
    cornerstoneTools.addTool(StackScrollMouseWheelTool);
    cornerstoneTools.addTool(LengthTool);
    cornerstoneTools.addTool(AngleTool);
    cornerstoneTools.addTool(EllipticalROITool);
    cornerstoneTools.addTool(RectangleROITool);
    cornerstoneTools.addTool(CircleROITool);
    cornerstoneTools.addTool(ArrowAnnotateTool);
    cornerstoneTools.addTool(BidirectionalTool);
    cornerstoneTools.addTool(CobbAngleTool);
    cornerstoneTools.addTool(PlanarFreehandROITool);
    cornerstoneTools.addTool(ProbeTool);
    cornerstoneTools.addTool(CrosshairsTool);
    cornerstoneTools.addTool(SegmentationDisplayTool);

    if (TrackballRotateTool) {
        cornerstoneTools.addTool(TrackballRotateTool);
    }
    if (VolumeRotateMouseWheelTool) {
        cornerstoneTools.addTool(VolumeRotateMouseWheelTool);
    }
    if (MIPJumpToClickTool) {
        cornerstoneTools.addTool(MIPJumpToClickTool);
    }

    console.log('All tools added');
}

/**
 * Create a tool group for viewports
 */
function createToolGroup(toolGroupId, viewportIds = []) {
    if (!toolGroupManager) {
        console.warn('Tool group manager not available');
        return null;
    }

    // Check if tool group already exists
    let toolGroup = toolGroupManager.getToolGroup(toolGroupId);
    if (toolGroup) {
        return toolGroup;
    }

    // Create new tool group
    toolGroup = toolGroupManager.createToolGroup(toolGroupId);

    // Add tools to group with bindings
    toolGroup.addTool(ToolNames.WindowLevel);
    toolGroup.addTool(ToolNames.Pan);
    toolGroup.addTool(ToolNames.Zoom);
    toolGroup.addTool(ToolNames.StackScroll);
    toolGroup.addTool(ToolNames.Length);
    toolGroup.addTool(ToolNames.Angle);
    toolGroup.addTool(ToolNames.EllipticalROI);
    toolGroup.addTool(ToolNames.RectangleROI);
    toolGroup.addTool(ToolNames.CircleROI);
    toolGroup.addTool(ToolNames.ArrowAnnotate);
    toolGroup.addTool(ToolNames.Bidirectional);
    toolGroup.addTool(ToolNames.Probe);
    toolGroup.addTool(ToolNames.Crosshairs);

    // Set initial tool states
    toolGroup.setToolActive(ToolNames.WindowLevel, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]
    });
    toolGroup.setToolActive(ToolNames.Pan, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Secondary }]
    });
    toolGroup.setToolActive(ToolNames.Zoom, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Auxiliary }]
    });
    toolGroup.setToolActive(ToolNames.StackScroll);

    // Add viewports to tool group
    viewportIds.forEach(id => {
        toolGroup.addViewport(id, renderingEngineId);
    });

    return toolGroup;
}

/**
 * Create MPR tool group with crosshairs
 */
function createMPRToolGroup(toolGroupId, viewportIds) {
    const toolGroup = createToolGroup(toolGroupId, viewportIds);

    if (toolGroup) {
        // Add crosshairs for MPR
        toolGroup.setToolActive(ToolNames.Crosshairs, {
            bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]
        });
    }

    return toolGroup;
}

/**
 * Create 3D tool group with rotation
 */
function create3DToolGroup(toolGroupId, viewportIds) {
    if (!toolGroupManager) return null;

    let toolGroup = toolGroupManager.getToolGroup(toolGroupId);
    if (!toolGroup) {
        toolGroup = toolGroupManager.createToolGroup(toolGroupId);
    }

    // Add 3D-specific tools
    if (cornerstoneTools.TrackballRotateTool) {
        toolGroup.addTool(ToolNames.TrackballRotate);
        toolGroup.setToolActive(ToolNames.TrackballRotate, {
            bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]
        });
    }

    toolGroup.addTool(ToolNames.Zoom);
    toolGroup.setToolActive(ToolNames.Zoom, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Secondary }]
    });

    toolGroup.addTool(ToolNames.Pan);
    toolGroup.setToolActive(ToolNames.Pan, {
        bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Auxiliary }]
    });

    viewportIds.forEach(id => {
        toolGroup.addViewport(id, renderingEngineId);
    });

    return toolGroup;
}

/**
 * Set active tool in a tool group
 */
function setActiveTool(toolGroupId, toolName) {
    if (!toolGroupManager) {
        console.warn('Tool group manager not available');
        return;
    }

    const toolGroup = toolGroupManager.getToolGroup(toolGroupId);
    if (!toolGroup) {
        console.warn('Tool group not found:', toolGroupId);
        return;
    }

    // List of primary mouse button tools that should be mutually exclusive
    const primaryTools = [
        'WindowLevel', 'Pan', 'Zoom', 'StackScrollMouseWheel',
        'Length', 'Angle', 'EllipticalROI', 'RectangleROI',
        'CircleROI', 'ArrowAnnotate', 'Bidirectional', 'Probe'
    ];

    // Deactivate/set to passive all primary tools first
    primaryTools.forEach(tool => {
        try {
            toolGroup.setToolPassive(tool);
        } catch (e) {
            // Tool might not be in this group, ignore
        }
    });

    // Set the new tool as active with primary mouse button
    try {
        toolGroup.setToolActive(toolName, {
            bindings: [{ mouseButton: cornerstoneTools.Enums.MouseBindings.Primary }]
        });
        console.log('Cornerstone tool activated:', toolName);
    } catch (e) {
        console.error('Failed to activate tool:', toolName, e);
    }
}

/**
 * Get the rendering engine
 */
function getRenderingEngine() {
    return renderingEngine;
}

/**
 * Create stack viewport
 */
async function createStackViewport(viewportId, element) {
    if (!renderingEngine) {
        console.error('Rendering engine not initialized');
        return null;
    }

    const viewportInput = {
        viewportId,
        element,
        type: cornerstoneCore.Enums.ViewportType.STACK
    };

    renderingEngine.enableElement(viewportInput);
    return renderingEngine.getViewport(viewportId);
}

/**
 * Create volume viewport for MPR
 */
async function createVolumeViewport(viewportId, element, orientation = 'AXIAL') {
    if (!renderingEngine) {
        console.error('Rendering engine not initialized');
        return null;
    }

    const orientationMap = {
        'AXIAL': cornerstoneCore.Enums.OrientationAxis.AXIAL,
        'SAGITTAL': cornerstoneCore.Enums.OrientationAxis.SAGITTAL,
        'CORONAL': cornerstoneCore.Enums.OrientationAxis.CORONAL
    };

    const viewportInput = {
        viewportId,
        element,
        type: cornerstoneCore.Enums.ViewportType.ORTHOGRAPHIC,
        defaultOptions: {
            orientation: orientationMap[orientation] || orientationMap['AXIAL']
        }
    };

    renderingEngine.enableElement(viewportInput);
    return renderingEngine.getViewport(viewportId);
}

/**
 * Create 3D viewport
 */
async function create3DViewport(viewportId, element) {
    if (!renderingEngine) {
        console.error('Rendering engine not initialized');
        return null;
    }

    const viewportInput = {
        viewportId,
        element,
        type: cornerstoneCore.Enums.ViewportType.VOLUME_3D
    };

    renderingEngine.enableElement(viewportInput);
    return renderingEngine.getViewport(viewportId);
}

/**
 * Load a volume from DICOM instances
 */
async function loadVolume(volumeId, imageIds) {
    if (!cornerstoneCore) return null;

    const volume = await cornerstoneCore.volumeLoader.createAndCacheVolume(volumeId, {
        imageIds
    });

    // Load the volume data
    await volume.load();

    return volume;
}

/**
 * Set volume on viewports
 */
async function setVolumeOnViewports(volumeId, viewportIds) {
    if (!renderingEngine) return;

    for (const viewportId of viewportIds) {
        const viewport = renderingEngine.getViewport(viewportId);
        if (viewport && viewport.setVolumes) {
            await viewport.setVolumes([{ volumeId }]);
        }
    }

    renderingEngine.render();
}

/**
 * Get all annotations
 */
function getAnnotations() {
    if (!cornerstoneTools) return [];

    const annotationManager = cornerstoneTools.annotation.state.getAnnotationManager();
    if (!annotationManager) return [];

    return annotationManager.getAllAnnotations();
}

/**
 * Get annotations for a specific viewport
 */
function getViewportAnnotations(viewportId) {
    if (!cornerstoneTools) return [];

    const annotations = cornerstoneTools.annotation.state.getAnnotations();
    return annotations.filter(a => a.metadata?.viewportId === viewportId);
}

/**
 * Clear all annotations
 */
function clearAllAnnotations() {
    if (!cornerstoneTools) return;

    const annotationManager = cornerstoneTools.annotation.state.getAnnotationManager();
    if (annotationManager) {
        annotationManager.removeAllAnnotations();
    }

    // Render to update display
    if (renderingEngine) {
        renderingEngine.render();
    }
}

/**
 * Export annotations to JSON format
 */
function exportAnnotationsToJSON() {
    const annotations = getAnnotations();

    return annotations.map(annotation => ({
        annotationType: annotation.metadata?.toolName,
        data: JSON.stringify(annotation.data),
        metadata: annotation.metadata,
        referencedImageId: annotation.metadata?.referencedImageId
    }));
}

/**
 * Import annotations from JSON
 */
function importAnnotationsFromJSON(annotationsJSON) {
    if (!cornerstoneTools) return;

    const annotationManager = cornerstoneTools.annotation.state.getAnnotationManager();

    annotationsJSON.forEach(a => {
        const annotation = {
            metadata: a.metadata,
            data: JSON.parse(a.data)
        };
        annotationManager.addAnnotation(annotation);
    });

    if (renderingEngine) {
        renderingEngine.render();
    }
}

/**
 * Fallback renderer for when Cornerstone3D is not available
 */
function initFallbackRenderer() {
    console.log('Using fallback renderer');
    window.useFallbackRenderer = true;
    isInitialized = true;
    return true;
}

/**
 * Check if initialized
 */
function isCornerstoneInitialized() {
    return isInitialized;
}

/**
 * Get viewport type constants
 */
function getViewportTypes() {
    return ViewportType;
}

/**
 * Get tool names
 */
function getToolNames() {
    return ToolNames;
}

// Export functions
window.CornerstoneService = {
    init: initCornerstoneAdvanced,
    isInitialized: isCornerstoneInitialized,
    getRenderingEngine,
    createStackViewport,
    createVolumeViewport,
    create3DViewport,
    createToolGroup,
    createMPRToolGroup,
    create3DToolGroup,
    setActiveTool,
    loadVolume,
    setVolumeOnViewports,
    getAnnotations,
    getViewportAnnotations,
    clearAllAnnotations,
    exportAnnotationsToJSON,
    importAnnotationsFromJSON,
    ViewportType,
    ToolNames
};

