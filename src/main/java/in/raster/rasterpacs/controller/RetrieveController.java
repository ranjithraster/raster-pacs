package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.service.cache.CacheCleanupScheduler;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import in.raster.rasterpacs.service.pacs.DicomRetrieveService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.CompletableFuture;

/**
 * REST Controller for managing DICOM retrieve operations
 */
@Slf4j
@RestController
@RequestMapping("/api/retrieve")
@CrossOrigin(origins = "*")
public class RetrieveController {

    private final DicomRetrieveService retrieveService;
    private final DicomCacheService cacheService;
    private final CacheCleanupScheduler cacheCleanupScheduler;

    public RetrieveController(
            DicomRetrieveService retrieveService,
            DicomCacheService cacheService,
            CacheCleanupScheduler cacheCleanupScheduler) {
        this.retrieveService = retrieveService;
        this.cacheService = cacheService;
        this.cacheCleanupScheduler = cacheCleanupScheduler;
    }

    /**
     * Retrieve a study from PACS
     */
    @PostMapping("/study/{studyUID}")
    public ResponseEntity<Map<String, Object>> retrieveStudy(
            @PathVariable String studyUID,
            @RequestParam(required = false) String pacsNode) {

        log.info("Starting retrieve for study: {}", studyUID);

        // Check if already cached
        if (cacheService.isStudyCached(studyUID)) {
            Map<String, Object> response = new HashMap<>();
            response.put("status", "ALREADY_CACHED");
            response.put("studyInstanceUid", studyUID);
            response.put("message", "Study is already in cache");
            return ResponseEntity.ok(response);
        }

        // Start async retrieve
        CompletableFuture<DicomRetrieveService.RetrieveResult> future =
                retrieveService.retrieveStudy(studyUID, pacsNode);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "STARTED");
        response.put("studyInstanceUid", studyUID);
        response.put("message", "Retrieve operation started. Connect to WebSocket for progress updates.");
        response.put("websocketTopic", "/topic/retrieve/" + studyUID);

        return ResponseEntity.accepted().body(response);
    }

    /**
     * Retrieve a series from PACS
     */
    @PostMapping("/study/{studyUID}/series/{seriesUID}")
    public ResponseEntity<Map<String, Object>> retrieveSeries(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @RequestParam(required = false) String pacsNode) {

        log.info("Starting retrieve for series: {}", seriesUID);

        // Start async retrieve
        CompletableFuture<DicomRetrieveService.RetrieveResult> future =
                retrieveService.retrieveSeries(studyUID, seriesUID, pacsNode);

        Map<String, Object> response = new HashMap<>();
        response.put("status", "STARTED");
        response.put("studyInstanceUid", studyUID);
        response.put("seriesInstanceUid", seriesUID);
        response.put("message", "Retrieve operation started");
        response.put("websocketTopic", "/topic/retrieve/" + studyUID);

        return ResponseEntity.accepted().body(response);
    }

    /**
     * Check cache status for a study
     */
    @GetMapping("/status/{studyUID}")
    public ResponseEntity<Map<String, Object>> getStudyStatus(@PathVariable String studyUID) {
        Map<String, Object> response = new HashMap<>();
        response.put("studyInstanceUid", studyUID);
        response.put("cached", cacheService.isStudyCached(studyUID));
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a cached study
     */
    @DeleteMapping("/cache/{studyUID}")
    public ResponseEntity<Map<String, Object>> deleteCachedStudy(@PathVariable String studyUID) {
        boolean deleted = cacheService.deleteStudy(studyUID);

        Map<String, Object> response = new HashMap<>();
        response.put("studyInstanceUid", studyUID);
        response.put("deleted", deleted);

        if (deleted) {
            return ResponseEntity.ok(response);
        } else {
            response.put("message", "Study not found in cache");
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Get cache statistics
     */
    @GetMapping("/cache/stats")
    public ResponseEntity<CacheCleanupScheduler.CacheStats> getCacheStats() {
        return ResponseEntity.ok(cacheCleanupScheduler.getCacheStats());
    }

    /**
     * Trigger cache cleanup
     */
    @PostMapping("/cache/cleanup")
    public ResponseEntity<Map<String, Object>> triggerCleanup() {
        cacheCleanupScheduler.triggerCleanup();

        Map<String, Object> response = new HashMap<>();
        response.put("status", "TRIGGERED");
        response.put("message", "Cache cleanup triggered");

        return ResponseEntity.ok(response);
    }
}

