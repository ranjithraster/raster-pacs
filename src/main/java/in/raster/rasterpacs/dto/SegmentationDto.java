package in.raster.rasterpacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO for DICOM Segmentation
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SegmentationDto {

    private Long id;
    private String studyInstanceUid;
    private String seriesInstanceUid;
    private String sopInstanceUid;
    private String referencedSeriesUid;
    private String segmentLabel;
    private String segmentDescription;
    private String segmentAlgorithmType;
    private String segmentAlgorithmName;
    private String segmentCategory;
    private String segmentType;
    private Integer segmentNumber;
    private String segmentColor;
    private Float segmentOpacity;
    private Integer totalFrames;
    private Integer rows;
    private Integer columns;
    private Double volumeMm3;
    private Double surfaceAreaMm2;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime modifiedAt;
    private String modifiedBy;
    private boolean exportedToSeg;
    private String segSopInstanceUid;

    // Frame-level mask data (for transfer)
    private List<FrameMask> frameMasks;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class FrameMask {
        private Integer frameNumber;
        private String sopInstanceUid;
        private String encodedMask;  // Base64 encoded RLE or raw mask
        private String encoding;     // "RLE", "RAW", "PNG"
    }
}

