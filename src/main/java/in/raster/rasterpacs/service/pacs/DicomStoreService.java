package in.raster.rasterpacs.service.pacs;

import in.raster.rasterpacs.config.DicomLocalProperties;
import in.raster.rasterpacs.config.PacsNodeProperties;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.io.DicomInputStream;
import org.dcm4che3.net.*;
import org.dcm4che3.net.pdu.AAssociateRQ;
import org.dcm4che3.net.pdu.PresentationContext;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.Executor;
import java.util.concurrent.Executors;

/**
 * Service for storing DICOM objects to PACS using C-STORE
 */
@Slf4j
@Service
public class DicomStoreService {

    private final PacsConnectionFactory connectionFactory;
    private final DicomLocalProperties localProperties;
    private final Executor executor;

    // Common Storage SOP Classes
    private static final String[] STORAGE_SOP_CLASSES = {
        UID.CTImageStorage,
        UID.MRImageStorage,
        UID.ComputedRadiographyImageStorage,
        UID.DigitalXRayImageStorageForPresentation,
        UID.DigitalXRayImageStorageForProcessing,
        UID.UltrasoundImageStorage,
        UID.UltrasoundMultiFrameImageStorage,
        UID.SecondaryCaptureImageStorage,
        UID.XRayAngiographicImageStorage,
        UID.NuclearMedicineImageStorage,
        UID.PositronEmissionTomographyImageStorage,
        UID.ComprehensiveSRStorage,
        UID.BasicTextSRStorage,
        UID.EnhancedSRStorage,
        UID.MammographyCADSRStorage,
        UID.KeyObjectSelectionDocumentStorage,
        UID.GrayscaleSoftcopyPresentationStateStorage,
        UID.EncapsulatedPDFStorage,
        UID.RawDataStorage,
        UID.VideoEndoscopicImageStorage,
        UID.VLWholeSlideMicroscopyImageStorage
    };

    private static final String[] TRANSFER_SYNTAXES = {
        UID.ExplicitVRLittleEndian,
        UID.ImplicitVRLittleEndian,
        UID.ExplicitVRBigEndian,
        UID.JPEGBaseline8Bit,
        UID.JPEGLosslessSV1,
        UID.JPEGLossless,
        UID.JPEG2000Lossless,
        UID.JPEG2000,
        UID.JPEGLSLossless,
        UID.JPEGLSNearLossless,
        UID.RLELossless
    };

    public DicomStoreService(
            PacsConnectionFactory connectionFactory,
            DicomLocalProperties localProperties) {
        this.connectionFactory = connectionFactory;
        this.localProperties = localProperties;
        this.executor = Executors.newFixedThreadPool(4);
    }

    /**
     * Store a DICOM file to PACS
     */
    public StoreResult storeToPacs(File dicomFile, String pacsNodeName) {
        log.info("C-STORE: Storing {} to PACS {}", dicomFile.getName(), pacsNodeName);

        StoreResult result = new StoreResult();
        result.setFilePath(dicomFile.getAbsolutePath());

        try {
            // Read DICOM file to get SOP Class and Transfer Syntax
            Attributes fmi;
            Attributes dataset;
            try (DicomInputStream dis = new DicomInputStream(dicomFile)) {
                fmi = dis.readFileMetaInformation();
                dataset = dis.readDataset();
            }

            String sopClassUid = fmi.getString(Tag.MediaStorageSOPClassUID);
            String sopInstanceUid = fmi.getString(Tag.MediaStorageSOPInstanceUID);
            String transferSyntax = fmi.getString(Tag.TransferSyntaxUID, UID.ExplicitVRLittleEndian);

            result.setSopInstanceUid(sopInstanceUid);
            result.setSopClassUid(sopClassUid);

            // Create association for C-STORE
            Association association = createStoreAssociation(pacsNodeName, sopClassUid, transferSyntax);

            try {
                // Perform C-STORE
                DimseRSPHandler rspHandler = new DimseRSPHandler(association.nextMessageID()) {
                    @Override
                    public void onDimseRSP(Association as, Attributes cmd, Attributes data) {
                        int status = cmd.getInt(Tag.Status, -1);
                        result.setStatus(status);
                        result.setSuccess(status == Status.Success);

                        if (status != Status.Success) {
                            result.setErrorMessage("C-STORE failed with status: " +
                                Integer.toHexString(status));
                            log.error("C-STORE failed with status: 0x{}", Integer.toHexString(status));
                        }
                    }
                };

                association.cstore(
                    sopClassUid,
                    sopInstanceUid,
                    Priority.NORMAL,
                    new DataWriterAdapter(dataset),
                    transferSyntax,
                    rspHandler
                );

                // Wait for response
                association.waitForOutstandingRSP();

                log.info("C-STORE completed for SOP Instance: {}", sopInstanceUid);

            } finally {
                connectionFactory.safeRelease(association);
            }

        } catch (Exception e) {
            log.error("C-STORE failed for file: {}", dicomFile, e);
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
        }

        return result;
    }

    /**
     * Store multiple DICOM files to PACS
     */
    public void storeMultipleToPacs(File[] dicomFiles, String pacsNodeName,
                                    StoreProgressListener progressListener) {
        log.info("C-STORE: Storing {} files to PACS {}", dicomFiles.length, pacsNodeName);

        int total = dicomFiles.length;
        int completed = 0;
        int failed = 0;

        for (File file : dicomFiles) {
            try {
                StoreResult result = storeToPacs(file, pacsNodeName);
                if (result.isSuccess()) {
                    completed++;
                } else {
                    failed++;
                }

                if (progressListener != null) {
                    progressListener.onProgress(completed, failed, total);
                }
            } catch (Exception e) {
                log.error("Failed to store file: {}", file, e);
                failed++;
            }
        }

        log.info("C-STORE batch complete: {}/{} succeeded, {} failed", completed, total, failed);
    }

    /**
     * Create association for C-STORE
     */
    private Association createStoreAssociation(String pacsNodeName, String sopClassUid,
                                               String transferSyntax) throws Exception {
        PacsNodeProperties.PacsNode pacsNode = connectionFactory.getPacsNode(pacsNodeName);

        Device device = new Device(localProperties.getAeTitle());
        Connection conn = new Connection();
        conn.setHostname(localProperties.getEffectiveBindAddress());
        conn.setPort(localProperties.getPort());
        device.addConnection(conn);

        ApplicationEntity ae = new ApplicationEntity(localProperties.getAeTitle());
        ae.addConnection(conn);
        device.addApplicationEntity(ae);

        // Create remote connection
        Connection remoteConn = new Connection();
        remoteConn.setHostname(pacsNode.getHostname());
        remoteConn.setPort(pacsNode.getPort());

        AAssociateRQ rq = new AAssociateRQ();
        rq.setCalledAET(pacsNode.getAeTitle());
        rq.setCallingAET(localProperties.getAeTitle());

        // Add presentation context for the SOP Class
        rq.addPresentationContext(new PresentationContext(1, sopClassUid,
            transferSyntax, UID.ExplicitVRLittleEndian, UID.ImplicitVRLittleEndian));

        // Start executor
        device.setExecutor(executor);
        device.setScheduledExecutor(Executors.newSingleThreadScheduledExecutor());

        return ae.connect(remoteConn, rq);
    }

    /**
     * Result of a C-STORE operation
     */
    @lombok.Data
    public static class StoreResult {
        private String filePath;
        private String sopInstanceUid;
        private String sopClassUid;
        private boolean success;
        private int status;
        private String errorMessage;
    }

    /**
     * Progress listener for batch store operations
     */
    public interface StoreProgressListener {
        void onProgress(int completed, int failed, int total);
    }
}

