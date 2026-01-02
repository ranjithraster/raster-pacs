package in.raster.rasterpacs.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

/**
 * DTO for DICOM query parameters
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class QueryRequest {

    // Patient level
    private String patientId;
    private String patientName;
    private String patientBirthDate;
    private String patientSex;

    // Study level
    private String studyInstanceUid;
    private String studyDate;
    private String studyDateFrom;
    private String studyDateTo;
    private String studyTime;
    private String accessionNumber;
    private String studyDescription;
    private String modalitiesInStudy;
    private String referringPhysicianName;
    private String studyId;

    // Series level
    private String seriesInstanceUid;
    private String seriesNumber;
    private String seriesDescription;
    private String modality;
    private String bodyPartExamined;

    // Instance level
    private String sopInstanceUid;
    private String sopClassUid;
    private String instanceNumber;

    // Query options
    private String queryRetrieveLevel;  // PATIENT, STUDY, SERIES, IMAGE
    private String pacsNodeName;
    private Integer limit;
    private Integer offset;
    private boolean fuzzyMatching;
}

