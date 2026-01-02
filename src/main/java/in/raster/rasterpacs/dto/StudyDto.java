package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.util.List;

/**
 * DTO for Study information returned by QIDO-RS
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class StudyDto {
    private String studyInstanceUid;
    private String studyDate;
    private String studyTime;
    private String studyDescription;
    private String accessionNumber;
    private String studyId;
    private String modalitiesInStudy;
    private String referringPhysicianName;
    private String institutionName;
    private Integer numberOfStudyRelatedSeries;
    private Integer numberOfStudyRelatedInstances;

    // Patient info
    private String patientId;
    private String patientName;
    private String patientBirthDate;
    private String patientSex;

    private boolean cached;
    private String sourceAeTitle;
}

