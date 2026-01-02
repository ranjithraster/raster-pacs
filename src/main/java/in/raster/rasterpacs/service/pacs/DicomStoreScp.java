package in.raster.rasterpacs.service.pacs;

import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.config.DicomLocalProperties;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.data.VR;
import org.dcm4che3.io.DicomOutputStream;
import org.dcm4che3.net.*;
import org.dcm4che3.net.pdu.PresentationContext;
import org.dcm4che3.net.service.BasicCStoreSCP;
import org.dcm4che3.net.service.DicomServiceException;
import org.dcm4che3.net.service.DicomServiceRegistry;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import jakarta.annotation.PreDestroy;
import java.io.File;
import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

/**
 * DICOM Storage SCP - receives DICOM objects from C-MOVE operations
 */
@Slf4j
@Service
public class DicomStoreScp {

    private final Device device;
    private final DicomLocalProperties localProperties;
    private final DicomCacheService cacheService;
    private final ExecutorService executorService;
    private final ScheduledExecutorService scheduledExecutorService;

    private boolean running = false;

    // Supported Storage SOP Classes
    private static final String[] STORAGE_SOP_CLASSES = {
            UID.CTImageStorage,
            UID.MRImageStorage,
            UID.EnhancedCTImageStorage,
            UID.EnhancedMRImageStorage,
            UID.ComputedRadiographyImageStorage,
            UID.DigitalXRayImageStorageForPresentation,
            UID.DigitalXRayImageStorageForProcessing,
            UID.DigitalMammographyXRayImageStorageForPresentation,
            UID.DigitalMammographyXRayImageStorageForProcessing,
            UID.UltrasoundImageStorage,
            UID.UltrasoundMultiFrameImageStorage,
            UID.SecondaryCaptureImageStorage,
            UID.MultiFrameSingleBitSecondaryCaptureImageStorage,
            UID.MultiFrameGrayscaleByteSecondaryCaptureImageStorage,
            UID.MultiFrameGrayscaleWordSecondaryCaptureImageStorage,
            UID.MultiFrameTrueColorSecondaryCaptureImageStorage,
            UID.XRayAngiographicImageStorage,
            UID.XRayRadiofluoroscopicImageStorage,
            UID.NuclearMedicineImageStorage,
            UID.PositronEmissionTomographyImageStorage,
            UID.RTImageStorage,
            UID.RTDoseStorage,
            UID.RTStructureSetStorage,
            UID.RTPlanStorage,
            UID.VLEndoscopicImageStorage,
            UID.VLMicroscopicImageStorage,
            UID.VLSlideCoordinatesMicroscopicImageStorage,
            UID.VLPhotographicImageStorage,
            UID.OphthalmicPhotography8BitImageStorage,
            UID.OphthalmicPhotography16BitImageStorage,
            UID.BasicTextSRStorage,
            UID.EnhancedSRStorage,
            UID.ComprehensiveSRStorage,
            UID.Comprehensive3DSRStorage,
            UID.GrayscaleSoftcopyPresentationStateStorage,
            UID.EncapsulatedPDFStorage,
            UID.EncapsulatedCDAStorage,
            UID.RawDataStorage,
            UID.SpatialRegistrationStorage,
            UID.SpatialFiducialsStorage,
            UID.DeformableSpatialRegistrationStorage,
            UID.SegmentationStorage,
            UID.SurfaceSegmentationStorage,
            UID.RealWorldValueMappingStorage,
            UID.BreastTomosynthesisImageStorage,
            UID.IntravascularOpticalCoherenceTomographyImageStorageForPresentation,
            UID.IntravascularOpticalCoherenceTomographyImageStorageForProcessing
    };

    // Supported Transfer Syntaxes
    private static final String[] TRANSFER_SYNTAXES = {
            UID.ImplicitVRLittleEndian,
            UID.ExplicitVRLittleEndian,
            UID.ExplicitVRBigEndian,
            UID.JPEGLosslessSV1,
            UID.JPEGLossless,
            UID.JPEG2000Lossless,
            UID.JPEG2000,
            UID.JPEGBaseline8Bit,
            UID.JPEGExtended12Bit,
            UID.RLELossless,
            UID.MPEG2MPML,
            UID.MPEG2MPHL,
            UID.MPEG4HP41,
            UID.MPEG4HP41BD
    };

    public DicomStoreScp(
            Device device,
            DicomLocalProperties localProperties,
            DicomCacheService cacheService,
            ExecutorService dicomExecutor,
            ScheduledExecutorService dicomScheduledExecutor) {
        this.device = device;
        this.localProperties = localProperties;
        this.cacheService = cacheService;
        this.executorService = dicomExecutor;
        this.scheduledExecutorService = dicomScheduledExecutor;
    }

    @PostConstruct
    public void init() {
        try {
            configureAndStart();
        } catch (Exception e) {
            log.error("Failed to start DICOM Storage SCP", e);
        }
    }

    @PreDestroy
    public void destroy() {
        stop();
    }

    /**
     * Configure and start the Storage SCP
     */
    public void configureAndStart() throws IOException, GeneralSecurityException {
        if (running) {
            log.info("Storage SCP is already running");
            return;
        }

        log.info("Configuring DICOM Storage SCP on port {}", localProperties.getPort());

        // Get the application entity
        ApplicationEntity ae = device.getApplicationEntity(localProperties.getAeTitle());

        // Configure the AE with C-STORE SCP handler
        DicomServiceRegistry serviceRegistry = new DicomServiceRegistry();
        serviceRegistry.addDicomService(createStoreSCP());
        ae.setDimseRQHandler(serviceRegistry);

        // Add accepted presentation contexts for storage
        for (String sopClass : STORAGE_SOP_CLASSES) {
            ae.addTransferCapability(new TransferCapability(
                    null, sopClass, TransferCapability.Role.SCP, TRANSFER_SYNTAXES));
        }

        // Also accept verification
        ae.addTransferCapability(new TransferCapability(
                null, UID.Verification, TransferCapability.Role.SCP,
                UID.ImplicitVRLittleEndian, UID.ExplicitVRLittleEndian));

        // Bind to network
        device.bindConnections();
        running = true;

        log.info("DICOM Storage SCP started - AE Title: {}, Port: {}",
                localProperties.getAeTitle(), localProperties.getPort());
    }

    /**
     * Stop the Storage SCP
     */
    public void stop() {
        if (!running) {
            return;
        }

        try {
            device.unbindConnections();
            running = false;
            log.info("DICOM Storage SCP stopped");
        } catch (Exception e) {
            log.error("Error stopping Storage SCP", e);
        }
    }

    /**
     * Create the C-STORE SCP handler
     */
    private BasicCStoreSCP createStoreSCP() {
        return new BasicCStoreSCP("*") {
            @Override
            protected void store(Association as, PresentationContext pc, Attributes rq,
                                PDVInputStream data, Attributes rsp) throws IOException {

                String sopClassUID = rq.getString(Tag.AffectedSOPClassUID);
                String sopInstanceUID = rq.getString(Tag.AffectedSOPInstanceUID);
                String transferSyntax = pc.getTransferSyntax();

                log.debug("Receiving C-STORE: SOP Instance UID = {}", sopInstanceUID);

                try {
                    // Read the dataset
                    Attributes dataset = data.readDataset(transferSyntax);

                    // Extract UIDs
                    String studyUID = dataset.getString(Tag.StudyInstanceUID);
                    String seriesUID = dataset.getString(Tag.SeriesInstanceUID);

                    // Store to cache
                    File outputFile = cacheService.storeInstance(studyUID, seriesUID, sopInstanceUID,
                            dataset, transferSyntax);

                    log.info("Stored DICOM instance: {} -> {}", sopInstanceUID, outputFile.getPath());

                    rsp.setInt(Tag.Status, VR.US, Status.Success);

                } catch (Exception e) {
                    log.error("Failed to store DICOM instance: {}", sopInstanceUID, e);
                    throw new DicomServiceException(Status.ProcessingFailure, e);
                }
            }
        };
    }

    /**
     * Check if the SCP is running
     */
    public boolean isRunning() {
        return running;
    }
}

