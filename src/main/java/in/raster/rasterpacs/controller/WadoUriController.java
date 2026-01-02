package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.dto.DicomDataset;
import in.raster.rasterpacs.service.dicom.DicomParserService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

/**
 * WADO-URI Controller
 * Implements legacy WADO (Web Access to DICOM Objects) URI-based specification
 * Compatible with older PACS viewers that use WADO-URI
 */
@Slf4j
@RestController
@RequestMapping("/wado")
@CrossOrigin(origins = "*")
public class WadoUriController {

    private static final String APPLICATION_DICOM = "application/dicom";

    private final DicomParserService dicomParserService;
    private final CacheProperties cacheProperties;

    public WadoUriController(DicomParserService dicomParserService,
                            CacheProperties cacheProperties) {
        this.dicomParserService = dicomParserService;
        this.cacheProperties = cacheProperties;
    }

    /**
     * WADO-URI Retrieve
     * GET /wado?requestType=WADO&studyUID=xxx&seriesUID=xxx&objectUID=xxx
     *
     * Query Parameters:
     * - requestType: Must be "WADO" (required)
     * - studyUID: Study Instance UID (required)
     * - seriesUID: Series Instance UID (required)
     * - objectUID: SOP Instance UID (required)
     * - contentType: Requested content type (optional)
     * - transferSyntax: Requested transfer syntax (optional)
     * - anonymize: Whether to anonymize (optional)
     * - frameNumber: Frame number for multi-frame images (optional)
     * - rows: Requested rows for scaling (optional)
     * - columns: Requested columns for scaling (optional)
     * - windowCenter: Window center for rendering (optional)
     * - windowWidth: Window width for rendering (optional)
     * - imageQuality: JPEG quality 1-100 (optional)
     */
    @GetMapping
    public ResponseEntity<byte[]> wadoRetrieve(
            @RequestParam String requestType,
            @RequestParam String studyUID,
            @RequestParam String seriesUID,
            @RequestParam String objectUID,
            @RequestParam(required = false, defaultValue = APPLICATION_DICOM) String contentType,
            @RequestParam(required = false) String transferSyntax,
            @RequestParam(required = false, defaultValue = "no") String anonymize,
            @RequestParam(required = false) Integer frameNumber,
            @RequestParam(required = false) Integer rows,
            @RequestParam(required = false) Integer columns,
            @RequestParam(required = false) Double windowCenter,
            @RequestParam(required = false) Double windowWidth,
            @RequestParam(required = false, defaultValue = "90") Integer imageQuality) {

        // Validate request type
        if (!"WADO".equalsIgnoreCase(requestType)) {
            log.warn("Invalid WADO request type: {}", requestType);
            return ResponseEntity.badRequest().build();
        }

        log.info("WADO-URI: Retrieve - Study: {}, Series: {}, Object: {}, ContentType: {}",
                studyUID, seriesUID, objectUID, contentType);

        // Find the file in cache
        Path filePath = getCacheFilePath(studyUID, seriesUID, objectUID);

        if (!Files.exists(filePath)) {
            log.warn("DICOM file not found in cache: {}", filePath);
            return ResponseEntity.notFound().build();
        }

        try {
            // Handle different content types
            if (APPLICATION_DICOM.equalsIgnoreCase(contentType) ||
                "application/dicom".equalsIgnoreCase(contentType)) {
                return retrieveDicom(filePath, objectUID);
            }
            else if (contentType.startsWith("image/jpeg") ||
                     contentType.startsWith("image/png")) {
                // TODO: Implement rendered image retrieval in Phase 2
                return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED)
                        .body("Rendered image retrieval not yet implemented".getBytes());
            }
            else {
                // Default to DICOM
                return retrieveDicom(filePath, objectUID);
            }
        } catch (IOException e) {
            log.error("Error reading DICOM file: {}", filePath, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve DICOM file
     */
    private ResponseEntity<byte[]> retrieveDicom(Path filePath, String objectUID) throws IOException {
        byte[] dicomData = Files.readAllBytes(filePath);

        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.parseMediaType(APPLICATION_DICOM));
        headers.setContentLength(dicomData.length);
        headers.set("Content-Disposition", "attachment; filename=\"" + objectUID + ".dcm\"");

        return new ResponseEntity<>(dicomData, headers, HttpStatus.OK);
    }

    /**
     * Get DICOM metadata via WADO
     * GET /wado/metadata?studyUID=xxx&seriesUID=xxx&objectUID=xxx
     */
    @GetMapping("/metadata")
    public ResponseEntity<DicomDataset> getMetadata(
            @RequestParam String studyUID,
            @RequestParam String seriesUID,
            @RequestParam String objectUID) {

        log.info("WADO-URI: Get metadata - Object: {}", objectUID);

        Path filePath = getCacheFilePath(studyUID, seriesUID, objectUID);

        if (!Files.exists(filePath)) {
            return ResponseEntity.notFound().build();
        }

        try {
            DicomDataset dataset = dicomParserService.parseDicomFile(filePath.toFile());
            return ResponseEntity.ok(dataset);
        } catch (IOException e) {
            log.error("Error parsing DICOM file: {}", filePath, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Helper method to get cache file path
     */
    private Path getCacheFilePath(String studyUID, String seriesUID, String instanceUID) {
        return Paths.get(cacheProperties.getPath(), studyUID, seriesUID, instanceUID + ".dcm");
    }
}

