package in.raster.rasterpacs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Local DICOM Application Entity configuration
 */
@Data
@ConfigurationProperties(prefix = "dicom.local")
public class DicomLocalProperties {

    /**
     * Local AE Title
     */
    private String aeTitle = "RASTER_PACS";

    /**
     * Address to bind to locally (0.0.0.0 for all interfaces)
     */
    private String bindAddress = "0.0.0.0";

    /**
     * Public hostname/IP to advertise to external PACS (for NAT scenarios)
     * If not set, uses bindAddress
     */
    private String publicHostname;

    /**
     * Hostname to bind to (deprecated, use bindAddress instead)
     */
    private String hostname = "0.0.0.0";

    /**
     * Port for DICOM SCP services
     */
    private int port = 11112;

    /**
     * Get the effective bind address (prefers bindAddress, falls back to hostname)
     */
    public String getEffectiveBindAddress() {
        if (bindAddress != null && !bindAddress.isEmpty()) {
            return bindAddress;
        }
        return hostname != null ? hostname : "0.0.0.0";
    }

    /**
     * Get the public hostname for C-MOVE destinations
     * Returns publicHostname if set, otherwise the bind address
     */
    public String getEffectivePublicHostname() {
        if (publicHostname != null && !publicHostname.isEmpty()) {
            return publicHostname;
        }
        return getEffectiveBindAddress();
    }
}

