package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.AnnotationDto;
import in.raster.rasterpacs.model.Annotation;
import in.raster.rasterpacs.service.annotation.AnnotationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for managing DICOM annotations
 */
@Slf4j
@RestController
@RequestMapping("/api/annotations")
@CrossOrigin(origins = "*")
public class AnnotationController {

    private final AnnotationService annotationService;

    public AnnotationController(AnnotationService annotationService) {
        this.annotationService = annotationService;
    }

    /**
     * Save an annotation
     */
    @PostMapping
    public ResponseEntity<AnnotationDto> saveAnnotation(@RequestBody AnnotationDto dto) {
        log.info("Saving annotation for instance: {}", dto.getSopInstanceUid());

        try {
            Annotation saved = annotationService.saveAnnotation(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved));
        } catch (Exception e) {
            log.error("Error saving annotation", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Save multiple annotations
     */
    @PostMapping("/batch")
    public ResponseEntity<List<AnnotationDto>> saveAnnotations(@RequestBody List<AnnotationDto> dtos) {
        log.info("Saving {} annotations", dtos.size());

        try {
            List<AnnotationDto> saved = dtos.stream()
                .map(dto -> {
                    Annotation annotation = annotationService.saveAnnotation(dto);
                    return toDto(annotation);
                })
                .toList();
            return ResponseEntity.status(HttpStatus.CREATED).body(saved);
        } catch (Exception e) {
            log.error("Error saving annotations", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get annotations for a study
     */
    @GetMapping("/study/{studyUid}")
    public ResponseEntity<List<AnnotationDto>> getStudyAnnotations(@PathVariable String studyUid) {
        log.info("Getting annotations for study: {}", studyUid);

        List<AnnotationDto> annotations = annotationService.getAnnotationsForStudy(studyUid);
        return ResponseEntity.ok(annotations);
    }

    /**
     * Get annotations for a series
     */
    @GetMapping("/study/{studyUid}/series/{seriesUid}")
    public ResponseEntity<List<AnnotationDto>> getSeriesAnnotations(
            @PathVariable String studyUid,
            @PathVariable String seriesUid) {
        log.info("Getting annotations for series: {}", seriesUid);

        List<AnnotationDto> annotations = annotationService.getAnnotationsForSeries(studyUid, seriesUid);
        return ResponseEntity.ok(annotations);
    }

    /**
     * Get annotations for an instance
     */
    @GetMapping("/study/{studyUid}/series/{seriesUid}/instance/{instanceUid}")
    public ResponseEntity<List<AnnotationDto>> getInstanceAnnotations(
            @PathVariable String studyUid,
            @PathVariable String seriesUid,
            @PathVariable String instanceUid) {
        log.info("Getting annotations for instance: {}", instanceUid);

        List<AnnotationDto> annotations = annotationService.getAnnotationsForInstance(studyUid, seriesUid, instanceUid);
        return ResponseEntity.ok(annotations);
    }

    /**
     * Delete an annotation
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteAnnotation(@PathVariable Long id) {
        log.info("Deleting annotation: {}", id);

        try {
            annotationService.deleteAnnotation(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting annotation", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Save annotations as DICOM SR and optionally store to PACS
     */
    @PostMapping("/save-as-sr")
    public ResponseEntity<Map<String, String>> saveAnnotationsAsSR(
            @RequestBody SaveSRRequest request) {
        log.info("Saving {} annotations as DICOM SR for study: {}",
            request.getAnnotations().size(), request.getStudyInstanceUid());

        try {
            String srInstanceUid = annotationService.saveAnnotationsAsDicomSR(
                request.getStudyInstanceUid(),
                request.getSeriesInstanceUid(),
                request.getAnnotations(),
                request.getPacsNode()
            );

            return ResponseEntity.ok(Map.of(
                "srInstanceUid", srInstanceUid,
                "message", "Annotations saved as DICOM SR successfully"
            ));
        } catch (Exception e) {
            log.error("Error saving annotations as SR", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Request body for saving annotations as SR
     */
    @lombok.Data
    public static class SaveSRRequest {
        private String studyInstanceUid;
        private String seriesInstanceUid;
        private List<AnnotationDto> annotations;
        private String pacsNode;
    }

    private AnnotationDto toDto(Annotation annotation) {
        return AnnotationDto.builder()
                .id(annotation.getId())
                .studyInstanceUid(annotation.getStudyInstanceUid())
                .seriesInstanceUid(annotation.getSeriesInstanceUid())
                .sopInstanceUid(annotation.getSopInstanceUid())
                .frameNumber(annotation.getFrameNumber())
                .annotationType(annotation.getAnnotationType())
                .data(annotation.getData())
                .label(annotation.getLabel())
                .createdAt(annotation.getCreatedAt())
                .createdBy(annotation.getCreatedBy())
                .savedToSr(annotation.isSavedToSr())
                .srInstanceUid(annotation.getSrInstanceUid())
                .build();
    }
}

