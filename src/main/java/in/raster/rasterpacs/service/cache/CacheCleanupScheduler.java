package in.raster.rasterpacs.service.cache;

import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.model.Study;
import in.raster.rasterpacs.repository.StudyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Scheduled service for cleaning up expired cache entries
 */
@Slf4j
@Service
public class CacheCleanupScheduler {

    private final CacheProperties cacheProperties;
    private final DicomCacheService cacheService;
    private final StudyRepository studyRepository;

    public CacheCleanupScheduler(
            CacheProperties cacheProperties,
            DicomCacheService cacheService,
            StudyRepository studyRepository) {
        this.cacheProperties = cacheProperties;
        this.cacheService = cacheService;
        this.studyRepository = studyRepository;
    }

    /**
     * Cleanup expired cache entries based on retention days
     * Runs at 2 AM daily by default
     */
    @Scheduled(cron = "${dicom.cache.cleanup-cron:0 0 2 * * ?}")
    public void cleanupExpiredCache() {
        log.info("Starting cache cleanup job");

        LocalDateTime cutoffDate = LocalDateTime.now().minusDays(cacheProperties.getRetentionDays());

        List<Study> expiredStudies = studyRepository.findCachedStudiesOlderThan(cutoffDate);

        log.info("Found {} studies older than {} days", expiredStudies.size(), cacheProperties.getRetentionDays());

        int deletedCount = 0;
        for (Study study : expiredStudies) {
            if (cacheService.deleteStudy(study.getStudyInstanceUid())) {
                deletedCount++;
            }
        }

        log.info("Cache cleanup completed: {} studies deleted", deletedCount);
    }

    /**
     * Cleanup cache if size exceeds maximum
     * Runs every hour
     */
    @Scheduled(cron = "0 0 * * * ?")
    public void cleanupOversizedCache() {
        long maxSizeBytes = (long) cacheProperties.getMaxSizeGb() * 1024 * 1024 * 1024;
        long currentSizeBytes = cacheService.getCacheSizeBytes();

        if (currentSizeBytes <= maxSizeBytes) {
            return;
        }

        log.info("Cache size ({} GB) exceeds maximum ({} GB). Starting cleanup...",
                currentSizeBytes / (1024 * 1024 * 1024),
                cacheProperties.getMaxSizeGb());

        // Delete least recently accessed studies until under limit
        List<Study> studies = studyRepository.findCachedStudiesOrderByLastAccessed();

        int deletedCount = 0;
        for (Study study : studies) {
            if (currentSizeBytes <= maxSizeBytes * 0.8) { // Cleanup to 80% of max
                break;
            }

            if (cacheService.deleteStudy(study.getStudyInstanceUid())) {
                deletedCount++;
                currentSizeBytes = cacheService.getCacheSizeBytes();
            }
        }

        log.info("Size-based cache cleanup completed: {} studies deleted", deletedCount);
    }

    /**
     * Manually trigger cleanup
     */
    public void triggerCleanup() {
        cleanupExpiredCache();
        cleanupOversizedCache();
    }

    /**
     * Get cache statistics
     */
    public CacheStats getCacheStats() {
        CacheStats stats = new CacheStats();
        stats.setTotalStudies(studyRepository.count());
        stats.setCachedStudies(studyRepository.findAll().stream()
                .filter(Study::isCached)
                .count());
        stats.setCacheSizeBytes(cacheService.getCacheSizeBytes());
        stats.setCacheSizeGb(stats.getCacheSizeBytes() / (1024.0 * 1024.0 * 1024.0));
        stats.setMaxSizeGb(cacheProperties.getMaxSizeGb());
        stats.setRetentionDays(cacheProperties.getRetentionDays());
        stats.setCachePath(cacheProperties.getPath());
        return stats;
    }

    /**
     * Cache statistics DTO
     */
    @lombok.Data
    public static class CacheStats {
        private long totalStudies;
        private long cachedStudies;
        private long cacheSizeBytes;
        private double cacheSizeGb;
        private int maxSizeGb;
        private int retentionDays;
        private String cachePath;
    }
}

