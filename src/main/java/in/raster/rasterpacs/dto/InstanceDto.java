package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * DTO for Instance (Image) information returned by QIDO-RS
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class InstanceDto {
    private String studyInstanceUid;
    private String seriesInstanceUid;
    private String sopInstanceUid;
    private String sopClassUid;
    private Integer instanceNumber;
    private String contentDate;
    private String contentTime;
    private String transferSyntaxUid;

    // Image attributes
    private Integer rows;
    private Integer columns;
    private Integer bitsAllocated;
    private Integer bitsStored;
    private Integer numberOfFrames;
    private String photometricInterpretation;
    private Double windowCenter;
    private Double windowWidth;

    // Spatial
    private Double sliceThickness;
    private Double sliceLocation;
    private String imagePositionPatient;
    private String imageOrientationPatient;
    private String pixelSpacing;

    private boolean cached;
    private String filePath;
}

