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
 * Study entity representing DICOM Study level
 */
@Data
@Entity
@Table(name = "studies", indexes = {
    @Index(name = "idx_study_instance_uid", columnList = "studyInstanceUid", unique = true),
    @Index(name = "idx_study_date", columnList = "studyDate"),
    @Index(name = "idx_accession_number", columnList = "accessionNumber")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Study {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String studyInstanceUid;

    @Column(length = 16)
    private String accessionNumber;

    private LocalDate studyDate;

    private LocalTime studyTime;

    @Column(length = 64)
    private String studyDescription;

    @Column(length = 16)
    private String studyId;

    @Column(length = 64)
    private String referringPhysicianName;

    @Column(length = 64)
    private String institutionName;

    @Column(length = 128)
    private String modalitiesInStudy;

    private Integer numberOfSeries;

    private Integer numberOfInstances;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "patient_id")
    private Patient patient;

    @OneToMany(mappedBy = "study", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Series> seriesList = new ArrayList<>();

    @Column(length = 64)
    private String sourceAeTitle;

    private boolean cached;

    private LocalDateTime cachedAt;

    private LocalDateTime lastAccessedAt;

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

