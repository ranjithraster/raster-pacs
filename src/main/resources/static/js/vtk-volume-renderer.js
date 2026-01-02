/**
 * VTK.js Volume Renderer
 * A robust 3D volume rendering solution using VTK.js
 * Supports VR, MIP, MinIP, and Surface rendering modes.
 */

// Import VTK modules as ES modules
import '@kitware/vtk.js/Rendering/Profiles/Volume';
import vtkFullScreenRenderWindow from '@kitware/vtk.js/Rendering/Misc/FullScreenRenderWindow';
import vtkVolume from '@kitware/vtk.js/Rendering/Core/Volume';
import vtkVolumeMapper from '@kitware/vtk.js/Rendering/Core/VolumeMapper';
import vtkColorTransferFunction from '@kitware/vtk.js/Rendering/Core/ColorTransferFunction';
import vtkPiecewiseFunction from '@kitware/vtk.js/Common/DataModel/PiecewiseFunction';
import vtkImageData from '@kitware/vtk.js/Common/DataModel/ImageData';
import vtkDataArray from '@kitware/vtk.js/Common/Core/DataArray';

class VTKVolumeRenderer {
    constructor(container) {
        this.container = container;
        this.renderWindow = null;
        this.renderer = null;
        this.actor = null;
        this.mapper = null;
        this.volumeData = null;
        this.isInitialized = false;
        this.renderMode = 'VR';
        this.interactor = null;
        this.openGLRenderWindow = null;

        // Rendering settings
        this.settings = {
            sampleDistance: 1.0,
            ambient: 0.2,
            diffuse: 0.7,
            specular: 0.3,
            shadingEnabled: true
        };

        // Current rotation for animation
        this.rotation = { x: 0, y: 0 };
        this.animationId = null;
    }

    /**
     * Initialize the VTK rendering pipeline
     */
    async initialize() {
        console.log('Initializing VTK Volume Renderer...');

        try {
            // Create a full screen render window within the container
            this.fullScreenRenderer = vtkFullScreenRenderWindow.newInstance({
                container: this.container,
                background: [0.05, 0.05, 0.1]
            });

            this.renderWindow = this.fullScreenRenderer.getRenderWindow();
            this.renderer = this.fullScreenRenderer.getRenderer();
            this.openGLRenderWindow = this.fullScreenRenderer.getApiSpecificRenderWindow();
            this.interactor = this.renderWindow.getInteractor();

            // Enable 3D interaction
            this.interactor.setDesiredUpdateRate(30.0);

            this.isInitialized = true;
            console.log('VTK Volume Renderer initialized successfully');

            return true;
        } catch (error) {
            console.error('Failed to initialize VTK renderer:', error);
            throw error;
        }
    }

    /**
     * Load volume data from HU array
     * @param {Float32Array} huData - Hounsfield Unit values
     * @param {Object} dimensions - {width, height, depth}
     * @param {Object} spacing - {x, y, z} voxel spacing in mm
     */
    async loadVolume(huData, dimensions, spacing = { x: 1, y: 1, z: 1 }) {
        if (!this.isInitialized) {
            await this.initialize();
        }

        console.log(`Loading volume: ${dimensions.width}x${dimensions.height}x${dimensions.depth}`);
        console.log(`Spacing: ${spacing.x}x${spacing.y}x${spacing.z} mm`);
        console.log(`Data length: ${huData.length}`);

        try {
            // Create VTK ImageData
            const imageData = vtkImageData.newInstance();
            imageData.setDimensions(dimensions.width, dimensions.height, dimensions.depth);
            imageData.setSpacing(spacing.x, spacing.y, spacing.z);
            imageData.setOrigin(0, 0, 0);

            // Create scalar data array
            const scalars = vtkDataArray.newInstance({
                numberOfComponents: 1,
                values: huData,
                name: 'Scalars'
            });

            imageData.getPointData().setScalars(scalars);

            // Get data range
            const dataRange = scalars.getRange();
            console.log(`HU Range: ${dataRange[0].toFixed(0)} to ${dataRange[1].toFixed(0)}`);

            // Remove existing actor if present
            if (this.actor) {
                this.renderer.removeVolume(this.actor);
            }

            // Create volume mapper
            this.mapper = vtkVolumeMapper.newInstance();
            this.mapper.setInputData(imageData);
            this.mapper.setSampleDistance(this.settings.sampleDistance);

            // Create color transfer function (for bone/tissue visualization)
            const ctfun = vtkColorTransferFunction.newInstance();

            // Create opacity transfer function
            const ofun = vtkPiecewiseFunction.newInstance();

            // Apply default preset (CT Bone)
            this.applyTransferFunction(ctfun, ofun, 'ct-bone', dataRange);

            // Create volume actor
            this.actor = vtkVolume.newInstance();
            this.actor.setMapper(this.mapper);

            // Configure volume properties
            const volumeProperty = this.actor.getProperty();
            volumeProperty.setRGBTransferFunction(0, ctfun);
            volumeProperty.setScalarOpacity(0, ofun);
            volumeProperty.setInterpolationTypeToLinear();

            // Apply shading settings
            if (this.settings.shadingEnabled) {
                volumeProperty.setShade(true);
                volumeProperty.setAmbient(this.settings.ambient);
                volumeProperty.setDiffuse(this.settings.diffuse);
                volumeProperty.setSpecular(this.settings.specular);
            } else {
                volumeProperty.setShade(false);
            }

            // Store references for later updates
            this.colorTransferFunction = ctfun;
            this.opacityTransferFunction = ofun;
            this.volumeProperty = volumeProperty;
            this.volumeData = imageData;
            this.dataRange = dataRange;

            // Add actor to renderer
            this.renderer.addVolume(this.actor);
            this.renderer.resetCamera();

            // Initial render
            this.render();

            console.log('Volume loaded and rendered successfully');
            return true;

        } catch (error) {
            console.error('Failed to load volume:', error);
            throw error;
        }
    }

    /**
     * Apply a preset transfer function
     */
    applyTransferFunction(ctfun, ofun, preset, dataRange) {
        // Clear existing points
        ctfun.removeAllPoints();
        ofun.removeAllPoints();

        const minHU = -1024;
        const maxHU = 3071;

        switch (preset) {
            case 'ct-bone':
                // Color transfer function for bone
                ctfun.addRGBPoint(minHU, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(-200, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(200, 0.9, 0.82, 0.76);
                ctfun.addRGBPoint(500, 1.0, 0.95, 0.85);
                ctfun.addRGBPoint(1000, 1.0, 1.0, 0.95);
                ctfun.addRGBPoint(maxHU, 1.0, 1.0, 1.0);

                // Opacity for bone
                ofun.addPoint(minHU, 0.0);
                ofun.addPoint(100, 0.0);
                ofun.addPoint(200, 0.15);
                ofun.addPoint(400, 0.5);
                ofun.addPoint(800, 0.85);
                ofun.addPoint(maxHU, 1.0);
                break;

            case 'ct-soft-tissue':
                ctfun.addRGBPoint(minHU, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(-100, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(0, 0.55, 0.25, 0.15);
                ctfun.addRGBPoint(100, 0.88, 0.60, 0.50);
                ctfun.addRGBPoint(200, 1.0, 0.80, 0.70);
                ctfun.addRGBPoint(maxHU, 1.0, 1.0, 1.0);

                ofun.addPoint(minHU, 0.0);
                ofun.addPoint(-100, 0.0);
                ofun.addPoint(0, 0.1);
                ofun.addPoint(100, 0.3);
                ofun.addPoint(200, 0.1);
                ofun.addPoint(maxHU, 0.0);
                break;

            case 'ct-skin':
                ctfun.addRGBPoint(minHU, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(-500, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(-200, 1.0, 0.85, 0.70);
                ctfun.addRGBPoint(0, 1.0, 0.85, 0.70);
                ctfun.addRGBPoint(maxHU, 1.0, 1.0, 1.0);

                ofun.addPoint(minHU, 0.0);
                ofun.addPoint(-500, 0.0);
                ofun.addPoint(-300, 0.0);
                ofun.addPoint(-200, 0.8);
                ofun.addPoint(0, 0.3);
                ofun.addPoint(maxHU, 0.0);
                break;

            case 'ct-lung':
                ctfun.addRGBPoint(minHU, 0.0, 0.2, 0.4);
                ctfun.addRGBPoint(-900, 0.2, 0.4, 0.6);
                ctfun.addRGBPoint(-700, 0.4, 0.6, 0.8);
                ctfun.addRGBPoint(-500, 0.6, 0.75, 0.9);
                ctfun.addRGBPoint(-300, 0.8, 0.85, 0.95);
                ctfun.addRGBPoint(maxHU, 1.0, 1.0, 1.0);

                ofun.addPoint(minHU, 0.0);
                ofun.addPoint(-900, 0.2);
                ofun.addPoint(-800, 0.4);
                ofun.addPoint(-700, 0.5);
                ofun.addPoint(-500, 0.2);
                ofun.addPoint(-300, 0.0);
                ofun.addPoint(maxHU, 0.0);
                break;

            case 'ct-vascular':
            case 'mip':
            default:
                // MIP-like rendering (grayscale)
                ctfun.addRGBPoint(minHU, 0.0, 0.0, 0.0);
                ctfun.addRGBPoint(0, 0.3, 0.3, 0.3);
                ctfun.addRGBPoint(500, 0.7, 0.7, 0.7);
                ctfun.addRGBPoint(1000, 1.0, 1.0, 1.0);
                ctfun.addRGBPoint(maxHU, 1.0, 1.0, 1.0);

                ofun.addPoint(minHU, 0.0);
                ofun.addPoint(0, 0.0);
                ofun.addPoint(100, 0.1);
                ofun.addPoint(500, 0.5);
                ofun.addPoint(1000, 0.9);
                ofun.addPoint(maxHU, 1.0);
                break;
        }
    }

    /**
     * Apply a rendering preset
     */
    applyPreset(presetName) {
        if (!this.colorTransferFunction || !this.opacityTransferFunction) {
            console.warn('Transfer functions not initialized');
            return;
        }

        console.log('Applying preset:', presetName);
        this.applyTransferFunction(
            this.colorTransferFunction,
            this.opacityTransferFunction,
            presetName,
            this.dataRange
        );
        this.render();
    }

    /**
     * Set rendering mode (VR, MIP, MinIP)
     */
    setRenderMode(mode) {
        if (!this.mapper) return;

        console.log('Setting render mode:', mode);
        this.renderMode = mode;

        switch (mode) {
            case 'MIP':
                this.mapper.setBlendModeToMaximumIntensity();
                break;
            case 'MinIP':
                this.mapper.setBlendModeToMinimumIntensity();
                break;
            case 'AIP':
                this.mapper.setBlendModeToAverageIntensity();
                break;
            case 'VR':
            default:
                this.mapper.setBlendModeToComposite();
                break;
        }

        this.render();
    }

    /**
     * Set sample distance for quality control
     */
    setSampleDistance(distance) {
        if (!this.mapper) return;
        this.settings.sampleDistance = distance;
        this.mapper.setSampleDistance(distance);
        this.render();
    }

    /**
     * Toggle shading
     */
    setShading(enabled) {
        if (!this.volumeProperty) return;
        this.settings.shadingEnabled = enabled;
        this.volumeProperty.setShade(enabled);
        this.render();
    }

    /**
     * Set shading parameters
     */
    setShadingParams(ambient, diffuse, specular) {
        if (!this.volumeProperty) return;
        this.settings.ambient = ambient;
        this.settings.diffuse = diffuse;
        this.settings.specular = specular;
        this.volumeProperty.setAmbient(ambient);
        this.volumeProperty.setDiffuse(diffuse);
        this.volumeProperty.setSpecular(specular);
        this.render();
    }

    /**
     * Reset camera to default view
     */
    resetCamera() {
        if (!this.renderer) return;
        this.renderer.resetCamera();
        this.render();
    }

    /**
     * Set standard view (anterior, posterior, left, right, superior, inferior)
     */
    setStandardView(view) {
        if (!this.renderer) return;

        const camera = this.renderer.getActiveCamera();
        const focalPoint = camera.getFocalPoint();
        const distance = camera.getDistance();

        switch (view) {
            case 'anterior':
                camera.setPosition(focalPoint[0], focalPoint[1] - distance, focalPoint[2]);
                camera.setViewUp(0, 0, 1);
                break;
            case 'posterior':
                camera.setPosition(focalPoint[0], focalPoint[1] + distance, focalPoint[2]);
                camera.setViewUp(0, 0, 1);
                break;
            case 'left':
                camera.setPosition(focalPoint[0] - distance, focalPoint[1], focalPoint[2]);
                camera.setViewUp(0, 0, 1);
                break;
            case 'right':
                camera.setPosition(focalPoint[0] + distance, focalPoint[1], focalPoint[2]);
                camera.setViewUp(0, 0, 1);
                break;
            case 'superior':
                camera.setPosition(focalPoint[0], focalPoint[1], focalPoint[2] + distance);
                camera.setViewUp(0, 1, 0);
                break;
            case 'inferior':
                camera.setPosition(focalPoint[0], focalPoint[1], focalPoint[2] - distance);
                camera.setViewUp(0, -1, 0);
                break;
        }

        this.renderer.resetCameraClippingRange();
        this.render();
    }

    /**
     * Start rotation animation
     */
    startAnimation(axis = 'Y', speed = 1) {
        if (this.animationId) return;

        const camera = this.renderer.getActiveCamera();
        const focalPoint = camera.getFocalPoint();

        const animate = () => {
            camera.azimuth(speed);
            this.renderer.resetCameraClippingRange();
            this.render();
            this.animationId = requestAnimationFrame(animate);
        };

        this.animationId = requestAnimationFrame(animate);
    }

    /**
     * Stop rotation animation
     */
    stopAnimation() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    /**
     * Toggle animation
     */
    toggleAnimation() {
        if (this.animationId) {
            this.stopAnimation();
            return false;
        } else {
            this.startAnimation();
            return true;
        }
    }

    /**
     * Resize the renderer
     */
    resize() {
        if (this.openGLRenderWindow) {
            this.openGLRenderWindow.resize();
            this.render();
        }
    }

    /**
     * Render the scene
     */
    render() {
        if (this.renderWindow) {
            this.renderWindow.render();
        }
    }

    /**
     * Capture screenshot
     */
    captureScreenshot() {
        if (!this.openGLRenderWindow) return null;

        // Force a render first
        this.render();

        // Get the canvas and create data URL
        const canvas = this.openGLRenderWindow.getCanvas();
        return canvas.toDataURL('image/png');
    }

    /**
     * Dispose of all resources
     */
    dispose() {
        this.stopAnimation();

        if (this.actor) {
            this.renderer.removeVolume(this.actor);
            this.actor.delete();
            this.actor = null;
        }

        if (this.mapper) {
            this.mapper.delete();
            this.mapper = null;
        }

        if (this.fullScreenRenderer) {
            this.fullScreenRenderer.delete();
            this.fullScreenRenderer = null;
        }

        this.volumeData = null;
        this.isInitialized = false;
    }
}

// Export for use
window.VTKVolumeRenderer = VTKVolumeRenderer;

