package in.raster.rasterpacs.service.pacs;

import in.raster.rasterpacs.config.DicomLocalProperties;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.data.VR;
import org.dcm4che3.io.DicomOutputStream;
import org.dcm4che3.net.*;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.messaging.simp.SimpMessagingTemplate;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

import java.io.IOException;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.atomic.AtomicInteger;

/**
 * Service for retrieving DICOM objects from PACS using C-GET or C-MOVE.
 *
 * C-GET is preferred as it doesn't require callback configuration.
 * C-MOVE requires the remote PACS to callback to this application.
 *
 * For C-MOVE to work:
 * 1. Your local DICOM SCP must be reachable from the remote PACS
 * 2. The remote PACS must have your AE Title and IP configured
 * 3. Firewalls must allow incoming connections on your DICOM port
 *
 * If C-MOVE fails with "destination unknown" (status a702H), the remote PACS
 * cannot reach your application. Try using C-GET instead.
 */
@Slf4j
@Service
public class DicomRetrieveService {

    private final PacsConnectionFactory connectionFactory;
    private final DicomLocalProperties localProperties;
    private final DicomCacheService cacheService;
    private final SimpMessagingTemplate messagingTemplate;

    @Value("${dicom.retrieve.prefer-cget:true}")
    private boolean preferCGet;

    @Value("${dicom.retrieve.fallback-to-cmove:true}")
    private boolean fallbackToCMove;

    public DicomRetrieveService(
            PacsConnectionFactory connectionFactory,
            DicomLocalProperties localProperties,
            DicomCacheService cacheService,
            SimpMessagingTemplate messagingTemplate) {
        this.connectionFactory = connectionFactory;
        this.localProperties = localProperties;
        this.cacheService = cacheService;
        this.messagingTemplate = messagingTemplate;
    }

    /**
     * Retrieve a study from PACS using C-GET (preferred) or C-MOVE
     */
    @Async("taskExecutor")
    public CompletableFuture<RetrieveResult> retrieveStudy(String studyInstanceUid, String pacsNodeName) {
        log.info("Starting retrieve for study: {}", studyInstanceUid);
        return retrieveWithStrategy(studyInstanceUid, null, null, "STUDY", pacsNodeName);
    }

    /**
     * Retrieve a series from PACS using C-GET (preferred) or C-MOVE
     */
    @Async("taskExecutor")
    public CompletableFuture<RetrieveResult> retrieveSeries(
            String studyInstanceUid,
            String seriesInstanceUid,
            String pacsNodeName) {
        log.info("Starting retrieve for series: {}", seriesInstanceUid);
        return retrieveWithStrategy(studyInstanceUid, seriesInstanceUid, null, "SERIES", pacsNodeName);
    }

    /**
     * Retrieve a single instance from PACS using C-GET (preferred) or C-MOVE
     */
    @Async("taskExecutor")
    public CompletableFuture<RetrieveResult> retrieveInstance(
            String studyInstanceUid,
            String seriesInstanceUid,
            String sopInstanceUid,
            String pacsNodeName) {
        log.info("Starting retrieve for instance: {}", sopInstanceUid);
        return retrieveWithStrategy(studyInstanceUid, seriesInstanceUid, sopInstanceUid, "IMAGE", pacsNodeName);
    }

    /**
     * Retrieve with strategy: try C-GET first, fallback to C-MOVE if needed
     */
    private CompletableFuture<RetrieveResult> retrieveWithStrategy(
            String studyInstanceUid,
            String seriesInstanceUid,
            String sopInstanceUid,
            String queryRetrieveLevel,
            String pacsNodeName) {

        if (preferCGet) {
            log.info("Using C-GET for retrieval (preferred)");
            RetrieveResult result = retrieveViaCGet(studyInstanceUid, seriesInstanceUid, sopInstanceUid, queryRetrieveLevel, pacsNodeName);

            if (!result.isSuccess() && fallbackToCMove) {
                log.warn("C-GET failed, falling back to C-MOVE. Error: {}", result.getErrorMessage());
                return retrieve(studyInstanceUid, seriesInstanceUid, sopInstanceUid, queryRetrieveLevel, pacsNodeName);
            }
            return CompletableFuture.completedFuture(result);
        } else {
            log.info("Using C-MOVE for retrieval");
            return retrieve(studyInstanceUid, seriesInstanceUid, sopInstanceUid, queryRetrieveLevel, pacsNodeName);
        }
    }

/**
     * Retrieve using C-GET - no callback required, data comes back on same connection
     */
    private RetrieveResult retrieveViaCGet(
            String studyInstanceUid,
            String seriesInstanceUid,
            String sopInstanceUid,
            String queryRetrieveLevel,
            String pacsNodeName) {

        RetrieveResult result = new RetrieveResult();
        result.setStudyInstanceUid(studyInstanceUid);
        result.setSeriesInstanceUid(seriesInstanceUid);
        result.setSopInstanceUid(sopInstanceUid);

        AtomicInteger completed = new AtomicInteger(0);
        AtomicInteger failed = new AtomicInteger(0);
        AtomicInteger total = new AtomicInteger(0);

        try {
            // Build C-GET keys
            Attributes keys = new Attributes();
            keys.setString(Tag.QueryRetrieveLevel, VR.CS, queryRetrieveLevel);
            keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);

            if (seriesInstanceUid != null) {
                keys.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUid);
            }
            if (sopInstanceUid != null) {
                keys.setString(Tag.SOPInstanceUID, VR.UI, sopInstanceUid);
            }

            // Create association with C-GET support
            Association association = connectionFactory.createGetAssociation(pacsNodeName);

            try {
                // Create a C-STORE handler to receive the images sent back by C-GET
                CGetRSPHandler handler = new CGetRSPHandler(association.nextMessageID(), studyInstanceUid,
                        completed, failed, total);

                // Execute C-GET - this is asynchronous, handler receives responses
                association.cget(
                        UID.StudyRootQueryRetrieveInformationModelGet,
                        Priority.NORMAL,
                        keys,
                        null,
                        handler
                );

                // Wait for completion
                handler.waitForCompletion();

                if (handler.getErrorMessage() != null) {
                    result.setSuccess(false);
                    result.setErrorMessage(handler.getErrorMessage());
                } else {
                    result.setTotalInstances(total.get());
                    result.setCompletedInstances(completed.get());
                    result.setFailedInstances(failed.get());
                    result.setSuccess(completed.get() > 0 || (total.get() == 0 && failed.get() == 0));

                    sendProgressUpdate(studyInstanceUid, completed.get(), total.get(),
                            result.isSuccess() ? "COMPLETED" : "COMPLETED_WITH_ERRORS");

                    log.info("C-GET completed for study {}: {}/{} instances retrieved",
                            studyInstanceUid, completed.get(), total.get());
                }

            } finally {
                connectionFactory.safeRelease(association);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("C-GET interrupted for study: {}", studyInstanceUid, e);
            result.setSuccess(false);
            result.setErrorMessage("C-GET interrupted: " + e.getMessage());
            sendProgressUpdate(studyInstanceUid, 0, 0, "FAILED");
        } catch (Exception e) {
            log.error("C-GET failed for study: {}", studyInstanceUid, e);
            result.setSuccess(false);
            result.setErrorMessage("C-GET error: " + e.getMessage());
            sendProgressUpdate(studyInstanceUid, 0, 0, "FAILED");
        }

        return result;
    }

    /**
     * Handler for C-GET responses
     */
    private class CGetRSPHandler extends DimseRSPHandler {
        private final String studyInstanceUid;
        private final AtomicInteger completed;
        private final AtomicInteger failed;
        private final AtomicInteger total;
        private volatile String errorMessage;
        private volatile boolean done = false;

        public CGetRSPHandler(int msgId, String studyInstanceUid,
                AtomicInteger completed, AtomicInteger failed, AtomicInteger total) {
            super(msgId);
            this.studyInstanceUid = studyInstanceUid;
            this.completed = completed;
            this.failed = failed;
            this.total = total;
        }

        @Override
        public void onDimseRSP(Association as, Attributes cmd, Attributes data) {
            super.onDimseRSP(as, cmd, data);

            int status = cmd.getInt(Tag.Status, -1);

            // Check for error statuses
            if (status == 0xa702 || status == 0xa701 || status == 0x0122) {
                errorMessage = "C-GET not supported by remote PACS (status: " + Integer.toHexString(status) + ")";
                log.warn("C-GET failed with status {}H - PACS may not support C-GET", Integer.toHexString(status));
                done = true;
                return;
            }

            if (Status.isPending(status)) {
                int remaining = cmd.getInt(Tag.NumberOfRemainingSuboperations, 0);
                int completedOps = cmd.getInt(Tag.NumberOfCompletedSuboperations, 0);
                int failedOps = cmd.getInt(Tag.NumberOfFailedSuboperations, 0);

                total.set(remaining + completedOps + failedOps);
                completed.set(completedOps);
                failed.set(failedOps);

                sendProgressUpdate(studyInstanceUid, completedOps, total.get(), STATUS_RETRIEVING);
                log.debug("C-GET progress: {}/{} completed, {} failed", completedOps, total.get(), failedOps);
            }

            // Handle completed status
            if (!Status.isPending(status)) {
                done = true;
            }

            // Handle incoming image data
            if (data != null) {
                try {
                    storeReceivedInstance(data);
                } catch (Exception e) {
                    log.error("Failed to store received instance", e);
                }
            }
        }

        public void waitForCompletion() throws InterruptedException {
            int timeout = 300; // 5 minutes max
            int waited = 0;
            while (!done && waited < timeout) {
                Thread.sleep(1000);
                waited++;
            }
        }

        public String getErrorMessage() {
            return errorMessage;
        }
    }

    /**
     * Store a received DICOM instance to cache
     */
    private void storeReceivedInstance(Attributes data) throws IOException {
        String studyUID = data.getString(Tag.StudyInstanceUID);
        String seriesUID = data.getString(Tag.SeriesInstanceUID);
        String sopInstanceUID = data.getString(Tag.SOPInstanceUID);
        String transferSyntax = UID.ExplicitVRLittleEndian; // Default

        if (studyUID != null && seriesUID != null && sopInstanceUID != null) {
            File outputFile = cacheService.storeInstance(studyUID, seriesUID, sopInstanceUID, data, transferSyntax);
            log.debug("Stored C-GET received instance: {} -> {}", sopInstanceUID, outputFile.getPath());
        }
    }

    // Status constants
    private static final String STATUS_RETRIEVING = "RETRIEVING";

    /**
     * Internal retrieve method using C-MOVE
     */
    private CompletableFuture<RetrieveResult> retrieve(
            String studyInstanceUid,
            String seriesInstanceUid,
            String sopInstanceUid,
            String queryRetrieveLevel,
            String pacsNodeName) {

        RetrieveResult result = new RetrieveResult();
        result.setStudyInstanceUid(studyInstanceUid);
        result.setSeriesInstanceUid(seriesInstanceUid);
        result.setSopInstanceUid(sopInstanceUid);

        try {
            // Build C-MOVE keys
            Attributes keys = new Attributes();
            keys.setString(Tag.QueryRetrieveLevel, VR.CS, queryRetrieveLevel);
            keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);

            if (seriesInstanceUid != null) {
                keys.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUid);
            }
            if (sopInstanceUid != null) {
                keys.setString(Tag.SOPInstanceUID, VR.UI, sopInstanceUid);
            }

            // Create association
            Association association = connectionFactory.createMoveAssociation(pacsNodeName);

            try {
                AtomicInteger completed = new AtomicInteger(0);
                AtomicInteger failed = new AtomicInteger(0);
                AtomicInteger warning = new AtomicInteger(0);
                AtomicInteger total = new AtomicInteger(0);

                // Execute C-MOVE
                DimseRSP rsp = association.cmove(
                        UID.StudyRootQueryRetrieveInformationModelMove,
                        Priority.NORMAL,
                        keys,
                        null,
                        localProperties.getAeTitle()  // Move destination
                );

                // Process responses
                while (rsp.next()) {
                    Attributes cmd = rsp.getCommand();
                    int status = cmd.getInt(Tag.Status, -1);

                    // Check for specific error codes
                    if (status == 0xa702) {
                        // Destination unknown - PACS cannot reach our SCP
                        log.warn("C-MOVE failed: destination unknown (status a702H). " +
                                "The remote PACS cannot reach your DICOM SCP. " +
                                "Ensure your AE Title {} is registered on the remote PACS with your IP.",
                                localProperties.getAeTitle());
                        result.setSuccess(false);
                        result.setErrorMessage("Destination unknown - remote PACS cannot reach this application");
                        break;
                    }

                    // Update counters from both pending and final responses
                    int remaining = cmd.getInt(Tag.NumberOfRemainingSuboperations, 0);
                    int completedOps = cmd.getInt(Tag.NumberOfCompletedSuboperations, 0);
                    int failedOps = cmd.getInt(Tag.NumberOfFailedSuboperations, 0);
                    int warningOps = cmd.getInt(Tag.NumberOfWarningSuboperations, 0);

                    // Update totals
                    if (completedOps > 0 || failedOps > 0 || remaining > 0) {
                        total.set(remaining + completedOps + failedOps + warningOps);
                        completed.set(completedOps);
                        failed.set(failedOps);
                        warning.set(warningOps);
                    }

                    if (Status.isPending(status)) {
                        // Send progress update via WebSocket
                        sendProgressUpdate(studyInstanceUid, completedOps, total.get(), "RETRIEVING");

                        log.debug("C-MOVE progress: {}/{} completed, {} failed",
                                completedOps, total.get(), failedOps);
                    }
                }

                if (result.getErrorMessage() == null) {
                    result.setTotalInstances(total.get());
                    result.setCompletedInstances(completed.get());
                    result.setFailedInstances(failed.get());
                    result.setWarningInstances(warning.get());
                    // Success if no failures reported (images are received via SCP callback)
                    result.setSuccess(failed.get() == 0);

                    // Send completion update
                    sendProgressUpdate(studyInstanceUid, completed.get(), total.get(),
                            result.isSuccess() ? "COMPLETED" : "COMPLETED_WITH_ERRORS");

                    log.info("C-MOVE completed for study {}: {}/{} instances retrieved, {} failed",
                            studyInstanceUid, completed.get(), total.get(), failed.get());
                }

            } finally {
                connectionFactory.safeRelease(association);
            }

        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            log.error("C-MOVE interrupted for study: {}", studyInstanceUid, e);
            result.setSuccess(false);
            result.setErrorMessage("C-MOVE interrupted: " + e.getMessage());
            sendProgressUpdate(studyInstanceUid, 0, 0, "FAILED");
        } catch (Exception e) {
            log.error("C-MOVE failed for study: {}", studyInstanceUid, e);
            result.setSuccess(false);
            result.setErrorMessage(e.getMessage());
            sendProgressUpdate(studyInstanceUid, 0, 0, "FAILED");
        }

        return CompletableFuture.completedFuture(result);
    }


    /**
     * Send progress update via WebSocket
     */
    private void sendProgressUpdate(String studyInstanceUid, int completed, int total, String status) {
        try {
            RetrieveProgress progress = new RetrieveProgress();
            progress.setStudyInstanceUid(studyInstanceUid);
            progress.setCompletedInstances(completed);
            progress.setTotalInstances(total);
            progress.setStatus(status);
            progress.setPercentComplete(total > 0 ? (completed * 100 / total) : 0);

            if (messagingTemplate != null) {
                messagingTemplate.convertAndSend("/topic/retrieve/" + studyInstanceUid, progress);
            }
        } catch (Exception e) {
            log.warn("Failed to send WebSocket progress update", e);
        }
    }

    /**
     * Result of a retrieve operation
     */
    @lombok.Data
    public static class RetrieveResult {
        private String studyInstanceUid;
        private String seriesInstanceUid;
        private String sopInstanceUid;
        private boolean success;
        private int totalInstances;
        private int completedInstances;
        private int failedInstances;
        private int warningInstances;
        private String errorMessage;
    }

    /**
     * Progress update for WebSocket
     */
    @lombok.Data
    public static class RetrieveProgress {
        private String studyInstanceUid;
        private int completedInstances;
        private int totalInstances;
        private int percentComplete;
        private String status;
    }
}

