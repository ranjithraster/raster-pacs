package in.raster.rasterpacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * DTO for DICOM annotations
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AnnotationDto {

    private Long id;
    private String studyInstanceUid;
    private String seriesInstanceUid;
    private String sopInstanceUid;
    private Integer frameNumber;
    private String annotationType;
    private String data;
    private String label;
    private LocalDateTime createdAt;
    private String createdBy;
    private boolean savedToSr;
    private String srInstanceUid;
}

