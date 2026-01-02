package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.InstanceDto;
import in.raster.rasterpacs.dto.QueryRequest;
import in.raster.rasterpacs.dto.SeriesDto;
import in.raster.rasterpacs.dto.StudyDto;
import in.raster.rasterpacs.service.pacs.DicomQueryService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

/**
 * QIDO-RS (Query based on ID for DICOM Objects - RESTful Services) Controller
 * Implements DICOMweb QIDO-RS specification for querying DICOM objects
 */
@Slf4j
@RestController
@RequestMapping("/dicomweb")
@CrossOrigin(origins = "*")
public class QidoRsController {

    private static final String APPLICATION_DICOM_JSON = "application/dicom+json";

    private final DicomQueryService dicomQueryService;

    public QidoRsController(DicomQueryService dicomQueryService) {
        this.dicomQueryService = dicomQueryService;
    }

    /**
     * Search for studies (QIDO-RS Studies)
     * GET /dicomweb/studies?PatientID=xxx&StudyDate=xxx...
     */
    @GetMapping(value = "/studies", produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<List<StudyDto>> searchStudies(
            @RequestParam(required = false) String PatientID,
            @RequestParam(required = false) String PatientName,
            @RequestParam(required = false) String PatientBirthDate,
            @RequestParam(required = false) String PatientSex,
            @RequestParam(required = false) String StudyInstanceUID,
            @RequestParam(required = false) String StudyDate,
            @RequestParam(required = false) String StudyTime,
            @RequestParam(required = false) String AccessionNumber,
            @RequestParam(required = false) String ModalitiesInStudy,
            @RequestParam(required = false) String ReferringPhysicianName,
            @RequestParam(required = false) String StudyDescription,
            @RequestParam(required = false) String StudyID,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false, defaultValue = "false") boolean fuzzymatching,
            @RequestParam(required = false) String pacsNode) {

        log.info("QIDO-RS: Search studies - PatientID={}, StudyDate={}, Modality={}",
                PatientID, StudyDate, ModalitiesInStudy);

        QueryRequest request = QueryRequest.builder()
                .patientId(PatientID)
                .patientName(PatientName)
                .patientBirthDate(PatientBirthDate)
                .patientSex(PatientSex)
                .studyInstanceUid(StudyInstanceUID)
                .studyDate(StudyDate)
                .studyTime(StudyTime)
                .accessionNumber(AccessionNumber)
                .modalitiesInStudy(ModalitiesInStudy)
                .referringPhysicianName(ReferringPhysicianName)
                .studyDescription(StudyDescription)
                .studyId(StudyID)
                .limit(limit)
                .offset(offset)
                .fuzzyMatching(fuzzymatching)
                .pacsNodeName(pacsNode)
                .build();

        try {
            List<StudyDto> studies = dicomQueryService.findStudies(request);
            return ResponseEntity.ok(studies);
        } catch (Exception e) {
            log.error("Error searching studies", e);
            return ResponseEntity.ok(List.of());  // Return empty list on error for client compatibility
        }
    }

    /**
     * Search for series within a study (QIDO-RS Series)
     * GET /dicomweb/studies/{studyUID}/series
     */
    @GetMapping(value = "/studies/{studyUID}/series",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<List<SeriesDto>> searchSeries(
            @PathVariable String studyUID,
            @RequestParam(required = false) String SeriesInstanceUID,
            @RequestParam(required = false) String Modality,
            @RequestParam(required = false) String SeriesNumber,
            @RequestParam(required = false) String SeriesDescription,
            @RequestParam(required = false) String BodyPartExamined,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false) String pacsNode) {

        log.info("QIDO-RS: Search series - StudyUID={}, Modality={}", studyUID, Modality);

        QueryRequest request = QueryRequest.builder()
                .seriesInstanceUid(SeriesInstanceUID)
                .modality(Modality)
                .seriesNumber(SeriesNumber)
                .seriesDescription(SeriesDescription)
                .bodyPartExamined(BodyPartExamined)
                .limit(limit)
                .offset(offset)
                .pacsNodeName(pacsNode)
                .build();

        try {
            List<SeriesDto> series = dicomQueryService.findSeries(studyUID, request);
            return ResponseEntity.ok(series);
        } catch (Exception e) {
            log.error("Error searching series for study {}", studyUID, e);
            return ResponseEntity.ok(List.of());  // Return empty list on error
        }
    }

    /**
     * Search for all series (QIDO-RS Series - all studies)
     * GET /dicomweb/series
     */
    @GetMapping(value = "/series", produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<List<SeriesDto>> searchAllSeries(
            @RequestParam(required = false) String StudyInstanceUID,
            @RequestParam(required = false) String SeriesInstanceUID,
            @RequestParam(required = false) String Modality,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false) String pacsNode) {

        if (StudyInstanceUID == null || StudyInstanceUID.isEmpty()) {
            return ResponseEntity.ok(List.of());  // Return empty list for missing StudyUID
        }

        QueryRequest request = QueryRequest.builder()
                .seriesInstanceUid(SeriesInstanceUID)
                .modality(Modality)
                .limit(limit)
                .offset(offset)
                .pacsNodeName(pacsNode)
                .build();

        try {
            List<SeriesDto> series = dicomQueryService.findSeries(StudyInstanceUID, request);
            return ResponseEntity.ok(series);
        } catch (Exception e) {
            log.error("Error searching series", e);
            return ResponseEntity.ok(List.of());  // Return empty list on error
        }
    }

    /**
     * Search for instances within a series (QIDO-RS Instances)
     * GET /dicomweb/studies/{studyUID}/series/{seriesUID}/instances
     */
    @GetMapping(value = "/studies/{studyUID}/series/{seriesUID}/instances",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<List<InstanceDto>> searchInstances(
            @PathVariable String studyUID,
            @PathVariable String seriesUID,
            @RequestParam(required = false) String SOPInstanceUID,
            @RequestParam(required = false) String SOPClassUID,
            @RequestParam(required = false) String InstanceNumber,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false) String pacsNode) {

        log.info("QIDO-RS: Search instances - StudyUID={}, SeriesUID={}", studyUID, seriesUID);

        QueryRequest request = QueryRequest.builder()
                .sopInstanceUid(SOPInstanceUID)
                .sopClassUid(SOPClassUID)
                .instanceNumber(InstanceNumber)
                .limit(limit)
                .offset(offset)
                .pacsNodeName(pacsNode)
                .build();

        try {
            List<InstanceDto> instances = dicomQueryService.findInstances(studyUID, seriesUID, request);
            return ResponseEntity.ok(instances);
        } catch (Exception e) {
            log.error("Error searching instances for series {}", seriesUID, e);
            return ResponseEntity.ok(List.of());  // Return empty list on error
        }
    }

    /**
     * Search for instances within a study (all series)
     * GET /dicomweb/studies/{studyUID}/instances
     */
    @GetMapping(value = "/studies/{studyUID}/instances",
                produces = {APPLICATION_DICOM_JSON, MediaType.APPLICATION_JSON_VALUE})
    public ResponseEntity<List<InstanceDto>> searchStudyInstances(
            @PathVariable String studyUID,
            @RequestParam(required = false) String SeriesInstanceUID,
            @RequestParam(required = false) String SOPInstanceUID,
            @RequestParam(required = false) Integer limit,
            @RequestParam(required = false) Integer offset,
            @RequestParam(required = false) String pacsNode) {

        if (SeriesInstanceUID == null || SeriesInstanceUID.isEmpty()) {
            // Would need to query all series first, simplified for now
            return ResponseEntity.ok(List.of());  // Return empty list for missing SeriesUID
        }

        QueryRequest request = QueryRequest.builder()
                .sopInstanceUid(SOPInstanceUID)
                .limit(limit)
                .offset(offset)
                .pacsNodeName(pacsNode)
                .build();

        try {
            List<InstanceDto> instances = dicomQueryService.findInstances(studyUID, SeriesInstanceUID, request);
            return ResponseEntity.ok(instances);
        } catch (Exception e) {
            log.error("Error searching instances for study {}", studyUID, e);
            return ResponseEntity.ok(List.of());  // Return empty list on error
        }
    }
}

