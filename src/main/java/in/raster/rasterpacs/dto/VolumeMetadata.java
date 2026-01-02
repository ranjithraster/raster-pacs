package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * DTO for volume metadata returned with raw pixel data for 3D rendering
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class VolumeMetadata {
    private String studyInstanceUid;
    private String seriesInstanceUid;

    // Image dimensions
    private Integer rows;
    private Integer columns;
    private Integer sliceCount;

    // Pixel data characteristics
    private Integer bitsAllocated;
    private Integer bitsStored;
    private Integer highBit;
    private Integer pixelRepresentation; // 0 = unsigned, 1 = signed
    private String photometricInterpretation;

    // Rescale parameters for HU conversion: HU = pixel * slope + intercept
    private Double rescaleSlope;
    private Double rescaleIntercept;
    private String rescaleType; // Usually "HU" for CT

    // Spatial information
    private Double sliceThickness;
    private Double spacingBetweenSlices;
    private List<Double> pixelSpacing; // [row spacing, column spacing]
    private List<Double> imagePositionPatient; // First slice position [x, y, z]
    private List<Double> imageOrientationPatient; // [row_x, row_y, row_z, col_x, col_y, col_z]

    // Slice positions (z-coordinates for sorting)
    private List<Double> slicePositions;

    // Data format info
    private String dataFormat; // "INT16" or "UINT16"
    private Long totalBytes;

    // Subsampling info (for progressive loading)
    private Integer subsampleFactor;
    private Integer originalSliceCount;
}

