package in.raster.rasterpacs.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * DTO for report templates
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ReportTemplateDto {

    private Long id;
    private String templateId;
    private String name;
    private String description;
    private String category;
    private String modality;
    private String bodyPart;
    private String procedureCode;
    private String defaultFindings;
    private String defaultImpression;
    private String defaultTechnique;
    private boolean isActive;
    private boolean isDefault;
    private Integer sortOrder;
    private String createdBy;
    private LocalDateTime createdAt;

    // Structured template content
    private List<TemplateSection> sections;
    private List<StructuredField> structuredFields;
    private List<TextMacro> macros;

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TemplateSection {
        private String name;
        private String type;  // TEXT, STRUCTURED, CHECKLIST
        private String defaultContent;
        private boolean required;
        private Integer sortOrder;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class StructuredField {
        private String name;
        private String label;
        private String type;  // TEXT, SELECT, MULTISELECT, NUMBER, DATE, CHECKBOX
        private List<String> options;
        private String defaultValue;
        private boolean required;
        private String validation;
        private String category;
    }

    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class TextMacro {
        private String shortcut;
        private String expansion;
        private String category;
        private String description;
    }
}

