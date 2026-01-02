package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

/**
 * Instance entity representing DICOM Instance (Image) level
 */
@Data
@Entity
@Table(name = "instances", indexes = {
    @Index(name = "idx_sop_instance_uid", columnList = "sopInstanceUid", unique = true),
    @Index(name = "idx_sop_class_uid", columnList = "sopClassUid")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Instance {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String sopInstanceUid;

    @Column(nullable = false, length = 64)
    private String sopClassUid;

    private Integer instanceNumber;

    private LocalDate contentDate;

    private LocalTime contentTime;

    @Column(length = 64)
    private String transferSyntaxUid;

    // Image attributes
    private Integer rows;

    private Integer columns;

    private Integer bitsAllocated;

    private Integer bitsStored;

    private Integer highBit;

    private Integer pixelRepresentation;

    private Integer samplesPerPixel;

    @Column(length = 16)
    private String photometricInterpretation;

    private Integer numberOfFrames;

    private Double windowCenter;

    private Double windowWidth;

    private Double rescaleIntercept;

    private Double rescaleSlope;

    // Spatial information
    private Double sliceThickness;

    private Double sliceLocation;

    @Column(length = 128)
    private String imagePositionPatient;

    @Column(length = 128)
    private String imageOrientationPatient;

    @Column(length = 128)
    private String pixelSpacing;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "series_id")
    private Series series;

    // Cache information
    @Column(length = 512)
    private String filePath;

    private Long fileSize;

    private boolean cached;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = createdAt;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}

