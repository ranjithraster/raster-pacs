package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.StudyDto;
import in.raster.rasterpacs.model.Study;
import in.raster.rasterpacs.repository.StudyRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * REST Controller for managing local cached studies
 */
@Slf4j
@RestController
@RequestMapping("/api/studies")
@CrossOrigin(origins = "*")
public class StudyController {

    private final StudyRepository studyRepository;

    public StudyController(StudyRepository studyRepository) {
        this.studyRepository = studyRepository;
    }

    /**
     * Get all cached studies
     */
    @GetMapping
    public ResponseEntity<List<StudyDto>> getAllCachedStudies() {
        List<Study> studies = studyRepository.findAll();
        List<StudyDto> dtos = studies.stream()
                .map(this::mapToDto)
                .collect(Collectors.toList());
        return ResponseEntity.ok(dtos);
    }

    /**
     * Get a specific study by UID
     */
    @GetMapping("/{studyInstanceUid}")
    public ResponseEntity<StudyDto> getStudy(@PathVariable String studyInstanceUid) {
        return studyRepository.findByStudyInstanceUid(studyInstanceUid)
                .map(study -> ResponseEntity.ok(mapToDto(study)))
                .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Check if a study is cached
     */
    @GetMapping("/{studyInstanceUid}/cached")
    public ResponseEntity<Map<String, Object>> isStudyCached(@PathVariable String studyInstanceUid) {
        boolean exists = studyRepository.existsByStudyInstanceUid(studyInstanceUid);
        Map<String, Object> response = new HashMap<>();
        response.put("studyInstanceUid", studyInstanceUid);
        response.put("cached", exists);
        return ResponseEntity.ok(response);
    }

    /**
     * Delete a cached study
     */
    @DeleteMapping("/{studyInstanceUid}")
    public ResponseEntity<Void> deleteCachedStudy(@PathVariable String studyInstanceUid) {
        return studyRepository.findByStudyInstanceUid(studyInstanceUid)
                .map(study -> {
                    studyRepository.delete(study);
                    log.info("Deleted cached study: {}", studyInstanceUid);
                    return ResponseEntity.noContent().<Void>build();
                })
                .orElse(ResponseEntity.notFound().build());
    }

    private StudyDto mapToDto(Study study) {
        return StudyDto.builder()
                .studyInstanceUid(study.getStudyInstanceUid())
                .studyDate(study.getStudyDate() != null ? study.getStudyDate().toString() : null)
                .studyTime(study.getStudyTime() != null ? study.getStudyTime().toString() : null)
                .studyDescription(study.getStudyDescription())
                .accessionNumber(study.getAccessionNumber())
                .studyId(study.getStudyId())
                .modalitiesInStudy(study.getModalitiesInStudy())
                .referringPhysicianName(study.getReferringPhysicianName())
                .institutionName(study.getInstitutionName())
                .numberOfStudyRelatedSeries(study.getNumberOfSeries())
                .numberOfStudyRelatedInstances(study.getNumberOfInstances())
                .patientId(study.getPatient() != null ? study.getPatient().getPatientId() : null)
                .patientName(study.getPatient() != null ? study.getPatient().getPatientName() : null)
                .patientBirthDate(study.getPatient() != null && study.getPatient().getPatientBirthDate() != null
                        ? study.getPatient().getPatientBirthDate().toString() : null)
                .patientSex(study.getPatient() != null ? study.getPatient().getPatientSex() : null)
                .cached(study.isCached())
                .sourceAeTitle(study.getSourceAeTitle())
                .build();
    }
}

