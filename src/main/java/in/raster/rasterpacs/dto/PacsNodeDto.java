package in.raster.rasterpacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * DTO for PACS Node settings
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class PacsNodeDto {
    private String name;
    private String aeTitle;
    private String hostname;
    private Integer port;
    private String description;
    private String queryRetrieveLevel;
    private boolean isDefault;
    private boolean isActive;

    // Connection status fields
    private boolean online;
    private String echoStatus;
    private String lastTestMessage;
    private Long responseTimeMs;
}

