package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.HashMap;
import java.util.Map;

/**
 * DTO representing a DICOM dataset as a map of tags
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DicomDataset {

    @Builder.Default
    private Map<String, DicomAttribute> attributes = new HashMap<>();

    public void addAttribute(String keyword, DicomAttribute attribute) {
        attributes.put(keyword, attribute);
    }

    public DicomAttribute getAttribute(String keyword) {
        return attributes.get(keyword);
    }

    public String getStringValue(String keyword) {
        DicomAttribute attr = attributes.get(keyword);
        return attr != null ? attr.getValueAsString() : null;
    }

    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    @Builder
    public static class DicomAttribute {
        private String tag;
        private String vr;
        private String keyword;
        private Object value;

        public String getValueAsString() {
            if (value == null) return null;
            if (value instanceof String[]) {
                return String.join("\\", (String[]) value);
            }
            return value.toString();
        }
    }
}

