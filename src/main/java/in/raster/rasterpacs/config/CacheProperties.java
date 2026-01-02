package in.raster.rasterpacs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuration properties for DICOM cache
 */
@Data
@ConfigurationProperties(prefix = "dicom.cache")
public class CacheProperties {

    /**
     * Path to store cached DICOM files
     */
    private String path = "./dicom-cache";

    /**
     * Number of days to retain cached studies
     */
    private int retentionDays = 30;

    /**
     * Maximum cache size in GB
     */
    private int maxSizeGb = 50;

    /**
     * Cron expression for cache cleanup job
     */
    private String cleanupCron = "0 0 2 * * ?";
}

