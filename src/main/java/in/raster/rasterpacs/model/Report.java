package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for storing radiology reports
 */
@Data
@Entity
@Table(name = "reports", indexes = {
    @Index(name = "idx_report_study", columnList = "studyInstanceUid"),
    @Index(name = "idx_report_status", columnList = "status"),
    @Index(name = "idx_report_created", columnList = "createdAt")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Report {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String studyInstanceUid;

    @Column(length = 64)
    private String accessionNumber;

    @Column(length = 100)
    private String patientId;

    @Column(length = 200)
    private String patientName;

    @Column(length = 100)
    private String templateId;

    @Column(length = 200)
    private String templateName;

    @Column(length = 50)
    private String reportType;  // DIAGNOSTIC, PRELIMINARY, ADDENDUM, FINAL

    @Column(length = 20)
    private String status;  // DRAFT, PRELIMINARY, FINAL, AMENDED, CANCELLED

    @Column(length = 500)
    private String title;

    @Column(columnDefinition = "TEXT")
    private String clinicalHistory;

    @Column(columnDefinition = "TEXT")
    private String technique;

    @Column(columnDefinition = "TEXT")
    private String comparison;

    @Column(columnDefinition = "TEXT")
    private String findings;

    @Column(columnDefinition = "TEXT")
    private String impression;

    @Column(columnDefinition = "TEXT")
    private String recommendations;

    @Column(columnDefinition = "TEXT")
    private String additionalComments;

    @Column(columnDefinition = "TEXT")
    private String structuredData;  // JSON for structured findings

    @Column(columnDefinition = "TEXT")
    private String measurementsJson;  // JSON for measurements from annotations

    @Column(columnDefinition = "TEXT")
    private String keyImagesJson;  // JSON for key image references

    @Column(length = 200)
    private String reportingPhysician;

    @Column(length = 200)
    private String referringPhysician;

    @Column(length = 100)
    private String institutionName;

    @Column(length = 50)
    private String priority;  // ROUTINE, STAT, URGENT

    @Column
    private LocalDateTime studyDate;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(length = 100)
    private String createdBy;

    private LocalDateTime modifiedAt;

    @Column(length = 100)
    private String modifiedBy;

    private LocalDateTime signedAt;

    @Column(length = 100)
    private String signedBy;

    @Column(length = 500)
    private String digitalSignature;

    @Column
    private boolean exportedToPdf;

    @Column(length = 512)
    private String pdfFilePath;

    @Column
    private boolean exportedToSr;

    @Column(length = 64)
    private String srSopInstanceUid;

    @Column
    private Integer version;

    @Column(length = 64)
    private String previousVersionId;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = createdAt;
        if (version == null) {
            version = 1;
        }
        if (status == null) {
            status = "DRAFT";
        }
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}

