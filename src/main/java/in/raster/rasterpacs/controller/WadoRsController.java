package in.raster.rasterpacs.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.dto.DicomDataset;
import in.raster.rasterpacs.dto.VolumeMetadata;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import in.raster.rasterpacs.service.dicom.DicomParserService;
import in.raster.rasterpacs.service.dicom.ImageRenderService;
import in.raster.rasterpacs.service.dicom.PixelDataService;
import in.raster.rasterpacs.service.pacs.DicomRetrieveService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.List;
import java.util.concurrent.CompletableFuture;

/**
 * WADO-RS (Web Access to DICOM Objects - RESTful Services) Controller
 * Implements DICOMweb WADO-RS specification for retrieving DICOM objects
 */
@Slf4j
@RestController
@RequestMapping("/dicomweb")
@CrossOrigin(origins = "*")
public class WadoRsController {

    private static final String APPLICATION_DICOM = "application/dicom";
    private static final String APPLICATION_DICOM_JSON = "application/dicom+json";
    private static final String MULTIPART_RELATED = "multipart/related";

    private final DicomParserService dicomParserService;
    private final DicomCacheService cacheService;
    private final ImageRenderService imageRenderService;
    private final DicomRetrieveService retrieveService;
    private final PixelDataService pixelDataService;
    private final CacheProperties cacheProperties;
    private final ObjectMapper objectMapper;

    public WadoRsController(
            DicomParserService dicomParserService,
            DicomCacheService cacheService,
            ImageRenderService imageRenderService,
            DicomRetrieveService retrieveService,
            PixelDataService pixelDataService,
            CacheProperties cacheProperties,
            ObjectMapper objectMapper) {
        this.dicomParserService = dicomParserService;
        this.cacheService = cacheService;
        this.imageRenderService = imageRenderService;
        this.retrieveService = retrieveService;
        this.pixelDataService = pixelDataService;
        this.cacheProperties = cacheProperties;
        this.objectMapper = objectMapper;
    }

    /**
     * Retrieve study (WADO-RS Study)
     * GET /dicomweb/studies/{studyUID}
     */
    @GetMapping(value = "/studies/{studyUID}", produces = MULTIPART_RELATED)
    public ResponseEntity<byte[]> retrieveStudy(
            @PathVariable String studyUID,
            @RequestParam(required = false) String pacsNode) {
        log.info("WADO-RS: Retrieve study - {}", studyUID);

        // Check if study is cached
        if (!cacheService.isStudyCached(studyUID)) {
            // Trigger retrieve from PACS
            retrieveService.retrieveStudy(studyUID, pacsNode);
            return ResponseEntity.accepted().build();
        }

        // TODO: Implement multipart response with all instances
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * Retrieve study metadata (WADO-RS Study Metadata)
     * GET /dicomweb/studies/{studyUID}/metadata
     */
    @GetMapping(value = "/studies/{studyUID}/metadata",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<String> retrieveStudyMetadata(@PathVariable String studyUID) {
        log.info("WADO-RS: Retrieve study metadata - {}", studyUID);

        // TODO: Implement retrieval of study metadata
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * Retrieve series (WADO-RS Series)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}", produces = MULTIPART_RELATED)
    public ResponseEntity<byte[]> retrieveSeries(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @RequestParam(required = false) String pacsNode) {
        log.info("WADO-RS: Retrieve series - Study: {}, Series: {}", studyUID, seriesUID);

        // Trigger retrieve if not cached
        if (!cacheService.isInstanceCached(studyUID, seriesUID, "*")) {
            retrieveService.retrieveSeries(studyUID, seriesUID, pacsNode);
            return ResponseEntity.accepted().build();
        }

        // TODO: Implement multipart response with all instances in series
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * Retrieve series metadata (WADO-RS Series Metadata)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/metadata
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/metadata",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<String> retrieveSeriesMetadata(
            @PathVariable String studyUID,
            @PathVariable String seriesUID) {
        log.info("WADO-RS: Retrieve series metadata - Study: {}, Series: {}", studyUID, seriesUID);

        // TODO: Implement retrieval of series metadata
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * Retrieve raw pixel data for 3D volume rendering
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/pixeldata
     *
     * Returns a multipart response:
     * - Part 1: JSON metadata (VolumeMetadata) with rescale parameters
     * - Part 2: Binary pixel data (Int16 little-endian)
     *
     * Query Parameters:
     * - subsample: Subsample factor (1 = all slices, 2 = every 2nd, 4 = every 4th)
     *              Used for progressive loading
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/pixeldata",
                produces = MULTIPART_RELATED)
    public ResponseEntity<byte[]> retrievePixelData(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @RequestParam(required = false, defaultValue = "1") Integer subsample,
            @RequestParam(required = false) String pacsNode) {

        log.info("WADO-RS: Retrieve pixel data for 3D - Study: {}, Series: {}, Subsample: {}",
                studyUID, seriesUID, subsample);

        // Get all cached files for this series
        List<File> cachedFiles = cacheService.getCachedSeriesFiles(studyUID, seriesUID);

        if (cachedFiles == null || cachedFiles.isEmpty()) {
            // Trigger retrieve from PACS
            log.info("Series not cached, triggering retrieval from PACS");
            retrieveService.retrieveSeries(studyUID, seriesUID, pacsNode);
            return ResponseEntity.accepted().build();
        }

        try {
            // Extract volume data
            PixelDataService.VolumeData volumeData = pixelDataService.extractVolumeData(cachedFiles, subsample);
            VolumeMetadata metadata = volumeData.getMetadata();
            byte[] pixelData = volumeData.getPixelData();

            // Build multipart response
            String boundary = "----VolumeDataBoundary" + System.currentTimeMillis();
            ByteArrayOutputStream baos = new ByteArrayOutputStream();

            // Part 1: JSON metadata
            String metadataJson = objectMapper.writeValueAsString(metadata);
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("Content-Type: application/json\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write(("Content-Length: " + metadataJson.length() + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write(metadataJson.getBytes(StandardCharsets.UTF_8));
            baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

            // Part 2: Binary pixel data
            baos.write(("--" + boundary + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("Content-Type: application/octet-stream\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write(("Content-Length: " + pixelData.length + "\r\n").getBytes(StandardCharsets.UTF_8));
            baos.write("\r\n".getBytes(StandardCharsets.UTF_8));
            baos.write(pixelData);
            baos.write("\r\n".getBytes(StandardCharsets.UTF_8));

            // End boundary
            baos.write(("--" + boundary + "--\r\n").getBytes(StandardCharsets.UTF_8));

            byte[] responseBody = baos.toByteArray();

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(
                "multipart/related; boundary=" + boundary));
            headers.setContentLength(responseBody.length);

            log.info("Returning volume data: {} slices, {} bytes total",
                metadata.getSliceCount(), responseBody.length);

            return new ResponseEntity<>(responseBody, headers, HttpStatus.OK);

        } catch (IOException e) {
            log.error("Error extracting pixel data: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve instance (WADO-RS Instance)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}")
    public ResponseEntity<byte[]> retrieveInstance(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @RequestParam(required = false) String pacsNode,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false) String accept) {

        log.info("WADO-RS: Retrieve instance - Study: {}, Series: {}, Instance: {}",
                studyUID, seriesUID, instanceUID);

        // Look for cached file
        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            // Trigger retrieve from PACS
            retrieveService.retrieveInstance(studyUID, seriesUID, instanceUID, pacsNode);
            return ResponseEntity.accepted().build();
        }

        try {
            byte[] dicomData = Files.readAllBytes(cachedFile.toPath());

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.parseMediaType(APPLICATION_DICOM));
            headers.setContentLength(dicomData.length);
            headers.set("Content-Disposition",
                    "attachment; filename=\"" + instanceUID + ".dcm\"");

            return new ResponseEntity<>(dicomData, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Error reading DICOM file: {}", cachedFile, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve instance metadata (WADO-RS Instance Metadata)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/metadata
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/metadata",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<DicomDataset> retrieveInstanceMetadata(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID) {

        log.info("WADO-RS: Retrieve instance metadata - Instance: {}", instanceUID);

        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            log.warn("Instance not found in cache: {}", instanceUID);
            return ResponseEntity.notFound().build();
        }

        try {
            DicomDataset dataset = dicomParserService.parseDicomFile(cachedFile);
            return ResponseEntity.ok(dataset);
        } catch (IOException e) {
            log.error("Error parsing DICOM file: {}", cachedFile, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve rendered instance (WADO-RS Rendered)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/rendered
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/rendered",
                produces = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE})
    public ResponseEntity<byte[]> retrieveRenderedInstance(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @RequestParam(required = false) Double window,
            @RequestParam(required = false) Double level,
            @RequestParam(required = false, defaultValue = "90") Integer quality,
            @RequestParam(required = false) Integer rows,
            @RequestParam(required = false) Integer columns,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false,
                          defaultValue = MediaType.IMAGE_JPEG_VALUE) String accept) {

        log.info("WADO-RS: Retrieve rendered instance - Instance: {}", instanceUID);

        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            log.warn("Instance not found in cache: {}", instanceUID);
            return ResponseEntity.notFound().build();
        }

        try {
            ImageRenderService.RenderParams params = new ImageRenderService.RenderParams();
            params.setWindowCenter(level);
            params.setWindowWidth(window);
            params.setQuality(quality);
            params.setRows(rows);
            params.setColumns(columns);

            byte[] imageData;
            MediaType contentType;

            if (accept.contains("png")) {
                imageData = imageRenderService.renderToPng(cachedFile, params);
                contentType = MediaType.IMAGE_PNG;
            } else {
                imageData = imageRenderService.renderToJpeg(cachedFile, params);
                contentType = MediaType.IMAGE_JPEG;
            }

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(contentType);
            headers.setContentLength(imageData.length);

            return new ResponseEntity<>(imageData, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Error rendering DICOM image: {}", cachedFile, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve specific frame (WADO-RS Frames)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frameNumber}
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frameNumber}")
    public ResponseEntity<byte[]> retrieveFrame(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @PathVariable int frameNumber) {

        log.info("WADO-RS: Retrieve frame {} of instance {}", frameNumber, instanceUID);

        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            return ResponseEntity.notFound().build();
        }

        // TODO: Extract specific frame pixel data
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }

    /**
     * Retrieve rendered frame (WADO-RS Rendered Frame)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frameNumber}/rendered
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/frames/{frameNumber}/rendered",
                produces = {MediaType.IMAGE_JPEG_VALUE, MediaType.IMAGE_PNG_VALUE})
    public ResponseEntity<byte[]> retrieveRenderedFrame(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @PathVariable int frameNumber,
            @RequestParam(required = false) Double window,
            @RequestParam(required = false) Double level,
            @RequestParam(required = false, defaultValue = "90") Integer quality,
            @RequestHeader(value = HttpHeaders.ACCEPT, required = false,
                          defaultValue = MediaType.IMAGE_JPEG_VALUE) String accept) {

        log.info("WADO-RS: Retrieve rendered frame {} of instance {}", frameNumber, instanceUID);

        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            return ResponseEntity.notFound().build();
        }

        try {
            ImageRenderService.RenderParams params = new ImageRenderService.RenderParams();
            params.setWindowCenter(level);
            params.setWindowWidth(window);
            params.setQuality(quality);

            byte[] imageData = imageRenderService.renderFrame(cachedFile, frameNumber, params);

            MediaType contentType = accept.contains("png") ? MediaType.IMAGE_PNG : MediaType.IMAGE_JPEG;

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(contentType);
            headers.setContentLength(imageData.length);

            return new ResponseEntity<>(imageData, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Error rendering frame: {}", instanceUID, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve thumbnail
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/thumbnail
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/thumbnail",
                produces = MediaType.IMAGE_JPEG_VALUE)
    public ResponseEntity<byte[]> retrieveThumbnail(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @RequestParam(required = false, defaultValue = "128") Integer size,
            @RequestParam(required = false) String pacsNode) {

        log.info("WADO-RS: Retrieve thumbnail - Instance: {}", instanceUID);

        File cachedFile = cacheService.getCachedFile(studyUID, seriesUID, instanceUID);

        if (cachedFile == null) {
            // Trigger retrieve from PACS - thumbnail will be available after retrieval
            try {
                retrieveService.retrieveInstance(studyUID, seriesUID, instanceUID, pacsNode);
            } catch (Exception e) {
                // Handle task rejection or other errors gracefully
                log.debug("Could not queue retrieval task for instance: {} - {}", instanceUID, e.getMessage());
            }
            return ResponseEntity.status(HttpStatus.ACCEPTED).build();
        }

        try {
            byte[] thumbnailData = imageRenderService.generateThumbnail(cachedFile, size);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.IMAGE_JPEG);
            headers.setContentLength(thumbnailData.length);
            headers.setCacheControl("max-age=86400"); // Cache for 24 hours

            return new ResponseEntity<>(thumbnailData, headers, HttpStatus.OK);
        } catch (IOException e) {
            log.error("Error generating thumbnail: {}", instanceUID, e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Retrieve bulk data (WADO-RS Bulk Data)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/bulk/{attributePath}
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances/{instanceUID}/bulk/{attributePath}")
    public ResponseEntity<byte[]> retrieveBulkData(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @PathVariable String instanceUID,
            @PathVariable String attributePath) {

        log.info("WADO-RS: Retrieve bulk data - Instance: {}, Path: {}", instanceUID, attributePath);

        // TODO: Implement bulk data retrieval
        return ResponseEntity.status(HttpStatus.NOT_IMPLEMENTED).build();
    }
}

