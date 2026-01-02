package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * DTO for Series information returned by QIDO-RS
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SeriesDto {
    private String studyInstanceUid;
    private String seriesInstanceUid;
    private String modality;
    private Integer seriesNumber;
    private String seriesDescription;
    private String seriesDate;
    private String seriesTime;
    private String bodyPartExamined;
    private String patientPosition;
    private String protocolName;
    private String performingPhysicianName;
    private Integer numberOfSeriesRelatedInstances;
    private boolean cached;
}

