package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Series entity representing DICOM Series level
 */
@Data
@Entity
@Table(name = "series", indexes = {
    @Index(name = "idx_series_instance_uid", columnList = "seriesInstanceUid", unique = true),
    @Index(name = "idx_series_modality", columnList = "modality")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Series {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String seriesInstanceUid;

    @Column(length = 16)
    private String modality;

    private Integer seriesNumber;

    @Column(length = 64)
    private String seriesDescription;

    private LocalDate seriesDate;

    private LocalTime seriesTime;

    @Column(length = 64)
    private String bodyPartExamined;

    @Column(length = 24)
    private String patientPosition;

    @Column(length = 64)
    private String protocolName;

    @Column(length = 64)
    private String performingPhysicianName;

    @Column(length = 64)
    private String operatorsName;

    private Integer numberOfInstances;

    @Column(length = 16)
    private String laterality;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "study_id")
    private Study study;

    @OneToMany(mappedBy = "series", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Instance> instances = new ArrayList<>();

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

