package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Entity for storing DICOM annotations
 */
@Data
@NoArgsConstructor
@Entity
@Table(name = "annotations", indexes = {
    @Index(name = "idx_annotation_study", columnList = "studyInstanceUid"),
    @Index(name = "idx_annotation_series", columnList = "seriesInstanceUid"),
    @Index(name = "idx_annotation_instance", columnList = "sopInstanceUid")
})
public class Annotation {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String studyInstanceUid;

    @Column(nullable = false, length = 64)
    private String seriesInstanceUid;

    @Column(nullable = false, length = 64)
    private String sopInstanceUid;

    @Column
    private Integer frameNumber;

    @Column(nullable = false, length = 50)
    private String annotationType;

    @Column(columnDefinition = "TEXT")
    private String data;

    @Column(length = 255)
    private String label;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 100)
    private String createdBy;

    @Column
    private boolean savedToSr = false;

    @Column(length = 64)
    private String srInstanceUid;

    @Column
    private LocalDateTime savedAt;

    @PrePersist
    protected void onCreate() {
        if (createdAt == null) {
            createdAt = LocalDateTime.now();
        }
    }
}

