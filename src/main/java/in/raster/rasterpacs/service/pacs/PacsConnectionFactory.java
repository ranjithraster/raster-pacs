package in.raster.rasterpacs.service.pacs;

import in.raster.rasterpacs.config.DicomLocalProperties;
import in.raster.rasterpacs.config.PacsNodeProperties;
import in.raster.rasterpacs.config.PacsNodeProperties.PacsNode;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.net.*;
import org.dcm4che3.net.pdu.AAssociateRQ;
import org.dcm4che3.net.pdu.PresentationContext;
import org.dcm4che3.net.pdu.RoleSelection;
import org.dcm4che3.data.UID;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.security.GeneralSecurityException;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.ScheduledExecutorService;

/**
 * Factory for creating DICOM associations with PACS nodes
 */
@Slf4j
@Service
public class PacsConnectionFactory {

    private final Device device;
    private final DicomLocalProperties localProperties;
    private final PacsNodeProperties pacsNodeProperties;
    private final ExecutorService executorService;
    private final ScheduledExecutorService scheduledExecutorService;

    // Standard transfer syntaxes
    private static final String[] TRANSFER_SYNTAXES = {
            UID.ExplicitVRLittleEndian,
            UID.ImplicitVRLittleEndian,
            UID.ExplicitVRBigEndian
    };

    public PacsConnectionFactory(
            Device device,
            DicomLocalProperties localProperties,
            PacsNodeProperties pacsNodeProperties,
            ExecutorService dicomExecutor,
            ScheduledExecutorService dicomScheduledExecutor) {
        this.device = device;
        this.localProperties = localProperties;
        this.pacsNodeProperties = pacsNodeProperties;
        this.executorService = dicomExecutor;
        this.scheduledExecutorService = dicomScheduledExecutor;
    }

    /**
     * Create a DICOM association for C-FIND
     */
    public Association createFindAssociation(String pacsNodeName) throws Exception {
        PacsNode pacsNode = getPacsNode(pacsNodeName);
        return createAssociation(pacsNode, createFindRQ(pacsNode));
    }

    /**
     * Create a DICOM association for C-MOVE
     */
    public Association createMoveAssociation(String pacsNodeName) throws Exception {
        PacsNode pacsNode = getPacsNode(pacsNodeName);
        return createAssociation(pacsNode, createMoveRQ(pacsNode));
    }

    /**
     * Create a DICOM association for C-GET
     */
    public Association createGetAssociation(String pacsNodeName) throws Exception {
        PacsNode pacsNode = getPacsNode(pacsNodeName);
        return createAssociation(pacsNode, createGetRQ(pacsNode));
    }

    /**
     * Create a DICOM association for C-ECHO
     */
    public Association createEchoAssociation(String pacsNodeName) throws Exception {
        PacsNode pacsNode = getPacsNode(pacsNodeName);
        return createAssociation(pacsNode, createEchoRQ(pacsNode));
    }

    /**
     * Perform C-ECHO to verify PACS connectivity
     */
    public boolean echo(String pacsNodeName) {
        try {
            Association association = createEchoAssociation(pacsNodeName);
            try {
                DimseRSP rsp = association.cecho();
                rsp.next();
                int status = rsp.getCommand().getInt(org.dcm4che3.data.Tag.Status, -1);
                return status == 0;
            } finally {
                safeRelease(association);
            }
        } catch (Exception e) {
            log.error("C-ECHO failed for PACS node: {}", pacsNodeName, e);
            return false;
        }
    }

    /**
     * Safely release an association
     */
    public void safeRelease(Association association) {
        if (association != null && association.isReadyForDataTransfer()) {
            try {
                association.release();
            } catch (IOException e) {
                log.warn("Failed to release association", e);
            }
        }
    }

    /**
     * Get PACS node configuration by name
     */
    public PacsNode getPacsNode(String pacsNodeName) {
        PacsNode node;
        if (pacsNodeName == null || pacsNodeName.isEmpty()) {
            node = pacsNodeProperties.getDefaultNode();
        } else {
            node = pacsNodeProperties.getNodeByName(pacsNodeName);
        }

        if (node == null) {
            throw new IllegalArgumentException("PACS node not found: " + pacsNodeName);
        }
        return node;
    }

    private Association createAssociation(PacsNode pacsNode, AAssociateRQ rq)
            throws IOException, InterruptedException, IncompatibleConnectionException, GeneralSecurityException {

        Connection remoteConn = new Connection();
        remoteConn.setHostname(pacsNode.getHostname());
        remoteConn.setPort(pacsNode.getPort());
        remoteConn.setConnectTimeout(pacsNode.getConnectionTimeout());
        remoteConn.setResponseTimeout(pacsNode.getResponseTimeout());

        ApplicationEntity localAE = device.getApplicationEntity(localProperties.getAeTitle());

        return localAE.connect(remoteConn, rq);
    }

    private AAssociateRQ createFindRQ(PacsNode pacsNode) {
        AAssociateRQ rq = new AAssociateRQ();
        rq.setCalledAET(pacsNode.getAeTitle());
        rq.setCallingAET(localProperties.getAeTitle());

        // Add presentation contexts for C-FIND SOP Classes
        int pcid = 1;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.PatientRootQueryRetrieveInformationModelFind, TRANSFER_SYNTAXES));
        pcid += 2;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.StudyRootQueryRetrieveInformationModelFind, TRANSFER_SYNTAXES));
        pcid += 2;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.PatientStudyOnlyQueryRetrieveInformationModelFind, TRANSFER_SYNTAXES));

        return rq;
    }

    private AAssociateRQ createMoveRQ(PacsNode pacsNode) {
        AAssociateRQ rq = new AAssociateRQ();
        rq.setCalledAET(pacsNode.getAeTitle());
        rq.setCallingAET(localProperties.getAeTitle());

        // Add presentation contexts for C-MOVE SOP Classes
        int pcid = 1;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.PatientRootQueryRetrieveInformationModelMove, TRANSFER_SYNTAXES));
        pcid += 2;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.StudyRootQueryRetrieveInformationModelMove, TRANSFER_SYNTAXES));

        return rq;
    }

    private AAssociateRQ createGetRQ(PacsNode pacsNode) {
        AAssociateRQ rq = new AAssociateRQ();
        rq.setCalledAET(pacsNode.getAeTitle());
        rq.setCallingAET(localProperties.getAeTitle());

        // Add presentation contexts for C-GET SOP Classes
        int pcid = 1;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.PatientRootQueryRetrieveInformationModelGet, TRANSFER_SYNTAXES));
        rq.addRoleSelection(new RoleSelection(
                UID.PatientRootQueryRetrieveInformationModelGet, false, true));

        pcid += 2;
        rq.addPresentationContext(new PresentationContext(pcid,
                UID.StudyRootQueryRetrieveInformationModelGet, TRANSFER_SYNTAXES));
        rq.addRoleSelection(new RoleSelection(
                UID.StudyRootQueryRetrieveInformationModelGet, false, true));

        // Add storage SOP classes for receiving images via C-GET
        String[] storageSopClasses = {
                UID.CTImageStorage,
                UID.MRImageStorage,
                UID.XRayAngiographicImageStorage,
                UID.XRayRadiofluoroscopicImageStorage,
                UID.DigitalXRayImageStorageForPresentation,
                UID.DigitalXRayImageStorageForProcessing,
                UID.DigitalMammographyXRayImageStorageForPresentation,
                UID.DigitalMammographyXRayImageStorageForProcessing,
                UID.ComputedRadiographyImageStorage,
                UID.UltrasoundImageStorage,
                UID.UltrasoundMultiFrameImageStorage,
                UID.SecondaryCaptureImageStorage,
                UID.NuclearMedicineImageStorage,
                UID.PositronEmissionTomographyImageStorage,
                UID.EnhancedCTImageStorage,
                UID.EnhancedMRImageStorage
        };

        String[] storageTSs = {
                UID.ExplicitVRLittleEndian,
                UID.ImplicitVRLittleEndian,
                UID.JPEGLosslessSV1,
                UID.JPEGLossless,
                UID.JPEG2000Lossless,
                UID.JPEG2000
        };

        for (String sopClass : storageSopClasses) {
            pcid += 2;
            rq.addPresentationContext(new PresentationContext(pcid, sopClass, storageTSs));
            rq.addRoleSelection(new RoleSelection(sopClass, false, true));
        }

        return rq;
    }

    private AAssociateRQ createEchoRQ(PacsNode pacsNode) {
        AAssociateRQ rq = new AAssociateRQ();
        rq.setCalledAET(pacsNode.getAeTitle());
        rq.setCallingAET(localProperties.getAeTitle());

        rq.addPresentationContext(new PresentationContext(1,
                UID.Verification, TRANSFER_SYNTAXES));

        return rq;
    }
}

