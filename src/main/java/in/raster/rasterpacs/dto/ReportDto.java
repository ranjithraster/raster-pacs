package in.raster.rasterpacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO for radiology reports
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportDto {

    private Long id;
    private String studyInstanceUid;
    private String accessionNumber;
    private String patientId;
    private String patientName;
    private String templateId;
    private String templateName;
    private String reportType;
    private String status;
    private String title;
    private String clinicalHistory;
    private String technique;
    private String comparison;
    private String findings;
    private String impression;
    private String recommendations;
    private String additionalComments;
    private String reportingPhysician;
    private String referringPhysician;
    private String institutionName;
    private String priority;
    private LocalDateTime studyDate;
    private LocalDateTime createdAt;
    private String createdBy;
    private LocalDateTime modifiedAt;
    private String modifiedBy;
    private LocalDateTime signedAt;
    private String signedBy;
    private boolean exportedToPdf;
    private String pdfFilePath;
    private boolean exportedToSr;
    private String srSopInstanceUid;
    private Integer version;

    // Structured data
    private List<StructuredFinding> structuredFindings;
    private List<Measurement> measurements;
    private List<KeyImage> keyImages;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StructuredFinding {
        private String category;
        private String finding;
        private String location;
        private String severity;
        private String characteristics;
        private String code;
        private String codingScheme;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class Measurement {
        private String type;
        private String label;
        private Double value;
        private String unit;
        private String location;
        private String sopInstanceUid;
        private Integer frameNumber;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class KeyImage {
        private String sopInstanceUid;
        private String seriesInstanceUid;
        private Integer frameNumber;
        private String description;
        private String thumbnailBase64;
    }
}

