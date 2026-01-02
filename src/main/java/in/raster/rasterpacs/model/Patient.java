package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Patient entity representing DICOM Patient level
 */
@Data
@Entity
@Table(name = "patients", indexes = {
    @Index(name = "idx_patient_id", columnList = "patientId"),
    @Index(name = "idx_patient_name", columnList = "patientName")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Patient {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String patientId;

    @Column(length = 256)
    private String patientName;

    private LocalDate patientBirthDate;

    @Column(length = 16)
    private String patientSex;

    @Column(length = 64)
    private String issuerOfPatientId;

    @OneToMany(mappedBy = "patient", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<Study> studies = new ArrayList<>();

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

