package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for storing report templates
 */
@Data
@Entity
@Table(name = "report_templates", indexes = {
    @Index(name = "idx_template_modality", columnList = "modality"),
    @Index(name = "idx_template_category", columnList = "category")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ReportTemplate {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String templateId;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(length = 500)
    private String description;

    @Column(length = 50)
    private String category;  // CT, MRI, XRAY, ULTRASOUND, NUCLEAR, MAMMOGRAPHY

    @Column(length = 50)
    private String modality;

    @Column(length = 100)
    private String bodyPart;

    @Column(length = 100)
    private String procedureCode;

    @Column(columnDefinition = "TEXT")
    private String templateContent;  // JSON structure of the template

    @Column(columnDefinition = "TEXT")
    private String defaultFindings;

    @Column(columnDefinition = "TEXT")
    private String defaultImpression;

    @Column(columnDefinition = "TEXT")
    private String defaultTechnique;

    @Column(columnDefinition = "TEXT")
    private String structuredFields;  // JSON defining structured input fields

    @Column(columnDefinition = "TEXT")
    private String macros;  // JSON for text macros/snippets

    @Column
    private boolean isActive;

    @Column
    private boolean isDefault;

    @Column
    private Integer sortOrder;

    @Column(length = 100)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime modifiedAt;

    @Column(length = 100)
    private String modifiedBy;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = createdAt;
        if (templateId == null) {
            templateId = "TPL-" + System.currentTimeMillis();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}

