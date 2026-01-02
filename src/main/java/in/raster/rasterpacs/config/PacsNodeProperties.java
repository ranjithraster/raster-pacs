package in.raster.rasterpacs.config;

import lombok.Data;
import org.springframework.boot.context.properties.ConfigurationProperties;

import java.util.ArrayList;
import java.util.List;

/**
 * Configuration properties for PACS nodes
 */
@Data
@ConfigurationProperties(prefix = "pacs")
public class PacsNodeProperties {

    private List<PacsNode> nodes = new ArrayList<>();

    @Data
    public static class PacsNode {
        private String name;
        private String aeTitle;
        private String hostname;
        private int port = 11112;
        private String description;
        private String queryRetrieveLevel = "STUDY";
        private int connectionTimeout = 5000;
        private int responseTimeout = 30000;
        private int associationTimeout = 60000;
    }

    /**
     * Get PACS node by name
     */
    public PacsNode getNodeByName(String name) {
        return nodes.stream()
                .filter(node -> node.getName().equalsIgnoreCase(name))
                .findFirst()
                .orElse(null);
    }

    /**
     * Get first configured PACS node
     */
    public PacsNode getDefaultNode() {
        return nodes.isEmpty() ? null : nodes.get(0);
    }
}

