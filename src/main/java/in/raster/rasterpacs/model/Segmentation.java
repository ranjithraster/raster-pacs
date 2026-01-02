package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for storing DICOM Segmentation data
 */
@Data
@Entity
@Table(name = "segmentations", indexes = {
    @Index(name = "idx_seg_study", columnList = "studyInstanceUid"),
    @Index(name = "idx_seg_series", columnList = "seriesInstanceUid"),
    @Index(name = "idx_seg_ref_series", columnList = "referencedSeriesUid")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Segmentation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String studyInstanceUid;

    @Column(length = 64)
    private String seriesInstanceUid;

    @Column(length = 64)
    private String sopInstanceUid;

    @Column(length = 64)
    private String referencedSeriesUid;

    @Column(nullable = false, length = 100)
    private String segmentLabel;

    @Column(length = 255)
    private String segmentDescription;

    @Column(length = 16)
    private String segmentAlgorithmType;  // MANUAL, SEMIAUTOMATIC, AUTOMATIC

    @Column(length = 100)
    private String segmentAlgorithmName;

    @Column(length = 50)
    private String segmentCategory;  // Organ, Lesion, etc.

    @Column(length = 50)
    private String segmentType;  // Liver, Tumor, etc.

    @Column
    private Integer segmentNumber;

    @Column(length = 7)
    private String segmentColor;  // Hex color like #FF0000

    @Column
    private Float segmentOpacity;

    @Column(columnDefinition = "LONGBLOB")
    private byte[] segmentData;  // Compressed segment mask data

    @Column
    private Integer totalFrames;

    @Column
    private Integer rows;

    @Column
    private Integer columns;

    @Column
    private Double volumeMm3;

    @Column
    private Double surfaceAreaMm2;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 100)
    private String createdBy;

    private LocalDateTime modifiedAt;

    @Column(length = 100)
    private String modifiedBy;

    @Column
    private boolean exportedToSeg;

    @Column(length = 64)
    private String segSopInstanceUid;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}

