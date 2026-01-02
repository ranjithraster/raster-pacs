package in.raster.rasterpacs.service.pacs;

import in.raster.rasterpacs.dto.*;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.data.VR;
import org.dcm4che3.net.Association;
import org.dcm4che3.net.DimseRSP;
import org.dcm4che3.net.Priority;
import org.dcm4che3.net.Status;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;

/**
 * Service for querying PACS using DICOM C-FIND operations
 */
@Slf4j
@Service
public class DicomQueryService {

    private final PacsConnectionFactory connectionFactory;

    public DicomQueryService(PacsConnectionFactory connectionFactory) {
        this.connectionFactory = connectionFactory;
    }

    /**
     * Query for studies from PACS
     */
    public List<StudyDto> findStudies(QueryRequest request) throws Exception {
        List<StudyDto> results = new ArrayList<>();

        Attributes keys = buildStudyLevelKeys(request);

        Association association = connectionFactory.createFindAssociation(request.getPacsNodeName());
        try {
            DimseRSP rsp = association.cfind(
                    UID.StudyRootQueryRetrieveInformationModelFind,
                    Priority.NORMAL,
                    keys,
                    null,
                    0
            );

            while (rsp.next()) {
                Attributes cmd = rsp.getCommand();
                int status = cmd.getInt(Tag.Status, -1);

                if (Status.isPending(status)) {
                    Attributes data = rsp.getDataset();
                    if (data != null) {
                        results.add(mapToStudyDto(data));
                    }
                }
            }

            log.info("Found {} studies from PACS", results.size());
            return results;
        } finally {
            connectionFactory.safeRelease(association);
        }
    }

    /**
     * Query for series within a study from PACS
     */
    public List<SeriesDto> findSeries(String studyInstanceUid, QueryRequest request) throws Exception {
        List<SeriesDto> results = new ArrayList<>();

        Attributes keys = buildSeriesLevelKeys(studyInstanceUid, request);

        Association association = connectionFactory.createFindAssociation(request.getPacsNodeName());
        try {
            DimseRSP rsp = association.cfind(
                    UID.StudyRootQueryRetrieveInformationModelFind,
                    Priority.NORMAL,
                    keys,
                    null,
                    0
            );

            while (rsp.next()) {
                Attributes cmd = rsp.getCommand();
                int status = cmd.getInt(Tag.Status, -1);

                if (Status.isPending(status)) {
                    Attributes data = rsp.getDataset();
                    if (data != null) {
                        results.add(mapToSeriesDto(data));
                    }
                }
            }

            log.info("Found {} series for study {}", results.size(), studyInstanceUid);
            return results;
        } finally {
            connectionFactory.safeRelease(association);
        }
    }

    /**
     * Query for instances within a series from PACS
     */
    public List<InstanceDto> findInstances(String studyInstanceUid, String seriesInstanceUid,
                                           QueryRequest request) throws Exception {
        List<InstanceDto> results = new ArrayList<>();

        Attributes keys = buildInstanceLevelKeys(studyInstanceUid, seriesInstanceUid, request);

        Association association = connectionFactory.createFindAssociation(request.getPacsNodeName());
        try {
            DimseRSP rsp = association.cfind(
                    UID.StudyRootQueryRetrieveInformationModelFind,
                    Priority.NORMAL,
                    keys,
                    null,
                    0
            );

            while (rsp.next()) {
                Attributes cmd = rsp.getCommand();
                int status = cmd.getInt(Tag.Status, -1);

                if (Status.isPending(status)) {
                    Attributes data = rsp.getDataset();
                    if (data != null) {
                        results.add(mapToInstanceDto(data));
                    }
                }
            }

            log.info("Found {} instances for series {}", results.size(), seriesInstanceUid);
            return results;
        } finally {
            connectionFactory.safeRelease(association);
        }
    }

    /**
     * Build DICOM Attributes for Study level C-FIND
     */
    private Attributes buildStudyLevelKeys(QueryRequest request) {
        Attributes keys = new Attributes();

        // Query/Retrieve Level
        keys.setString(Tag.QueryRetrieveLevel, VR.CS, "STUDY");

        // Patient level attributes to return
        keys.setString(Tag.PatientID, VR.LO, nvl(request.getPatientId(), ""));
        keys.setString(Tag.PatientName, VR.PN, nvl(request.getPatientName(), ""));
        keys.setString(Tag.PatientBirthDate, VR.DA, nvl(request.getPatientBirthDate(), ""));
        keys.setString(Tag.PatientSex, VR.CS, nvl(request.getPatientSex(), ""));

        // Study level attributes to return
        keys.setString(Tag.StudyInstanceUID, VR.UI, nvl(request.getStudyInstanceUid(), ""));
        keys.setString(Tag.AccessionNumber, VR.SH, nvl(request.getAccessionNumber(), ""));
        keys.setString(Tag.StudyDescription, VR.LO, nvl(request.getStudyDescription(), ""));
        keys.setString(Tag.StudyID, VR.SH, nvl(request.getStudyId(), ""));
        keys.setString(Tag.ReferringPhysicianName, VR.PN, nvl(request.getReferringPhysicianName(), ""));
        keys.setString(Tag.InstitutionName, VR.LO, "");
        keys.setString(Tag.ModalitiesInStudy, VR.CS, nvl(request.getModalitiesInStudy(), ""));

        // Study date/time - handle range queries
        String studyDate = buildDateRange(request.getStudyDate(),
                                          request.getStudyDateFrom(),
                                          request.getStudyDateTo());
        keys.setString(Tag.StudyDate, VR.DA, studyDate);
        keys.setString(Tag.StudyTime, VR.TM, nvl(request.getStudyTime(), ""));

        // Counts
        keys.setNull(Tag.NumberOfStudyRelatedSeries, VR.IS);
        keys.setNull(Tag.NumberOfStudyRelatedInstances, VR.IS);

        return keys;
    }

    /**
     * Build DICOM Attributes for Series level C-FIND
     */
    private Attributes buildSeriesLevelKeys(String studyInstanceUid, QueryRequest request) {
        Attributes keys = new Attributes();

        // Query/Retrieve Level
        keys.setString(Tag.QueryRetrieveLevel, VR.CS, "SERIES");

        // Study UID (required)
        keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);

        // Series level attributes to return
        keys.setString(Tag.SeriesInstanceUID, VR.UI, nvl(request.getSeriesInstanceUid(), ""));
        keys.setString(Tag.Modality, VR.CS, nvl(request.getModality(), ""));
        keys.setString(Tag.SeriesNumber, VR.IS, nvl(request.getSeriesNumber(), ""));
        keys.setString(Tag.SeriesDescription, VR.LO, nvl(request.getSeriesDescription(), ""));
        keys.setString(Tag.SeriesDate, VR.DA, "");
        keys.setString(Tag.SeriesTime, VR.TM, "");
        keys.setString(Tag.BodyPartExamined, VR.CS, nvl(request.getBodyPartExamined(), ""));
        keys.setString(Tag.PatientPosition, VR.CS, "");
        keys.setString(Tag.ProtocolName, VR.LO, "");
        keys.setString(Tag.PerformingPhysicianName, VR.PN, "");
        keys.setNull(Tag.NumberOfSeriesRelatedInstances, VR.IS);

        return keys;
    }

    /**
     * Build DICOM Attributes for Instance level C-FIND
     */
    private Attributes buildInstanceLevelKeys(String studyInstanceUid, String seriesInstanceUid,
                                              QueryRequest request) {
        Attributes keys = new Attributes();

        // Query/Retrieve Level
        keys.setString(Tag.QueryRetrieveLevel, VR.CS, "IMAGE");

        // Study and Series UID (required)
        keys.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);
        keys.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUid);

        // Instance level attributes to return
        keys.setString(Tag.SOPInstanceUID, VR.UI, nvl(request.getSopInstanceUid(), ""));
        keys.setString(Tag.SOPClassUID, VR.UI, nvl(request.getSopClassUid(), ""));
        keys.setString(Tag.InstanceNumber, VR.IS, nvl(request.getInstanceNumber(), ""));
        keys.setString(Tag.ContentDate, VR.DA, "");
        keys.setString(Tag.ContentTime, VR.TM, "");

        // Image attributes
        keys.setNull(Tag.Rows, VR.US);
        keys.setNull(Tag.Columns, VR.US);
        keys.setNull(Tag.BitsAllocated, VR.US);
        keys.setNull(Tag.BitsStored, VR.US);
        keys.setNull(Tag.NumberOfFrames, VR.IS);
        keys.setString(Tag.PhotometricInterpretation, VR.CS, "");
        keys.setNull(Tag.WindowCenter, VR.DS);
        keys.setNull(Tag.WindowWidth, VR.DS);

        // Spatial information
        keys.setNull(Tag.SliceThickness, VR.DS);
        keys.setNull(Tag.SliceLocation, VR.DS);
        keys.setString(Tag.ImagePositionPatient, VR.DS, "");
        keys.setString(Tag.ImageOrientationPatient, VR.DS, "");
        keys.setString(Tag.PixelSpacing, VR.DS, "");

        return keys;
    }

    /**
     * Map DICOM Attributes to StudyDto
     */
    private StudyDto mapToStudyDto(Attributes attrs) {
        return StudyDto.builder()
                .studyInstanceUid(attrs.getString(Tag.StudyInstanceUID))
                .studyDate(attrs.getString(Tag.StudyDate))
                .studyTime(attrs.getString(Tag.StudyTime))
                .studyDescription(attrs.getString(Tag.StudyDescription))
                .accessionNumber(attrs.getString(Tag.AccessionNumber))
                .studyId(attrs.getString(Tag.StudyID))
                .modalitiesInStudy(attrs.getString(Tag.ModalitiesInStudy))
                .referringPhysicianName(attrs.getString(Tag.ReferringPhysicianName))
                .institutionName(attrs.getString(Tag.InstitutionName))
                .numberOfStudyRelatedSeries(attrs.getInt(Tag.NumberOfStudyRelatedSeries, 0))
                .numberOfStudyRelatedInstances(attrs.getInt(Tag.NumberOfStudyRelatedInstances, 0))
                .patientId(attrs.getString(Tag.PatientID))
                .patientName(attrs.getString(Tag.PatientName))
                .patientBirthDate(attrs.getString(Tag.PatientBirthDate))
                .patientSex(attrs.getString(Tag.PatientSex))
                .build();
    }

    /**
     * Map DICOM Attributes to SeriesDto
     */
    private SeriesDto mapToSeriesDto(Attributes attrs) {
        return SeriesDto.builder()
                .studyInstanceUid(attrs.getString(Tag.StudyInstanceUID))
                .seriesInstanceUid(attrs.getString(Tag.SeriesInstanceUID))
                .modality(attrs.getString(Tag.Modality))
                .seriesNumber(attrs.getInt(Tag.SeriesNumber, 0))
                .seriesDescription(attrs.getString(Tag.SeriesDescription))
                .seriesDate(attrs.getString(Tag.SeriesDate))
                .seriesTime(attrs.getString(Tag.SeriesTime))
                .bodyPartExamined(attrs.getString(Tag.BodyPartExamined))
                .patientPosition(attrs.getString(Tag.PatientPosition))
                .protocolName(attrs.getString(Tag.ProtocolName))
                .performingPhysicianName(attrs.getString(Tag.PerformingPhysicianName))
                .numberOfSeriesRelatedInstances(attrs.getInt(Tag.NumberOfSeriesRelatedInstances, 0))
                .build();
    }

    /**
     * Map DICOM Attributes to InstanceDto
     */
    private InstanceDto mapToInstanceDto(Attributes attrs) {
        return InstanceDto.builder()
                .studyInstanceUid(attrs.getString(Tag.StudyInstanceUID))
                .seriesInstanceUid(attrs.getString(Tag.SeriesInstanceUID))
                .sopInstanceUid(attrs.getString(Tag.SOPInstanceUID))
                .sopClassUid(attrs.getString(Tag.SOPClassUID))
                .instanceNumber(attrs.getInt(Tag.InstanceNumber, 0))
                .contentDate(attrs.getString(Tag.ContentDate))
                .contentTime(attrs.getString(Tag.ContentTime))
                .rows(attrs.getInt(Tag.Rows, 0))
                .columns(attrs.getInt(Tag.Columns, 0))
                .bitsAllocated(attrs.getInt(Tag.BitsAllocated, 0))
                .bitsStored(attrs.getInt(Tag.BitsStored, 0))
                .numberOfFrames(attrs.getInt(Tag.NumberOfFrames, 1))
                .photometricInterpretation(attrs.getString(Tag.PhotometricInterpretation))
                .windowCenter(attrs.getDouble(Tag.WindowCenter, 0))
                .windowWidth(attrs.getDouble(Tag.WindowWidth, 0))
                .sliceThickness(attrs.getDouble(Tag.SliceThickness, 0))
                .sliceLocation(attrs.getDouble(Tag.SliceLocation, 0))
                .imagePositionPatient(attrs.getString(Tag.ImagePositionPatient))
                .imageOrientationPatient(attrs.getString(Tag.ImageOrientationPatient))
                .pixelSpacing(attrs.getString(Tag.PixelSpacing))
                .build();
    }

    /**
     * Build date range string for DICOM query
     */
    private String buildDateRange(String exactDate, String fromDate, String toDate) {
        if (exactDate != null && !exactDate.isEmpty()) {
            return exactDate;
        }
        if (fromDate != null && !fromDate.isEmpty() && toDate != null && !toDate.isEmpty()) {
            return fromDate + "-" + toDate;
        }
        if (fromDate != null && !fromDate.isEmpty()) {
            return fromDate + "-";
        }
        if (toDate != null && !toDate.isEmpty()) {
            return "-" + toDate;
        }
        return "";
    }

    private String nvl(String value, String defaultValue) {
        return value != null ? value : defaultValue;
    }
}

