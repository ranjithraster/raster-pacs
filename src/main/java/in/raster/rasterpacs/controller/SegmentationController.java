package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.SegmentationDto;
import in.raster.rasterpacs.model.Segmentation;
import in.raster.rasterpacs.service.segmentation.SegmentationService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;

/**
 * REST Controller for managing DICOM Segmentations
 */
@Slf4j
@RestController
@RequestMapping("/api/segmentations")
@CrossOrigin(origins = "*")
public class SegmentationController {

    private final SegmentationService segmentationService;

    public SegmentationController(SegmentationService segmentationService) {
        this.segmentationService = segmentationService;
    }

    /**
     * Save a new segmentation
     */
    @PostMapping
    public ResponseEntity<SegmentationDto> saveSegmentation(@RequestBody SegmentationDto dto) {
        log.info("Saving segmentation: {} for study {}", dto.getSegmentLabel(), dto.getStudyInstanceUid());

        try {
            Segmentation saved = segmentationService.saveSegmentation(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(toDto(saved));
        } catch (Exception e) {
            log.error("Error saving segmentation", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update an existing segmentation
     */
    @PutMapping("/{id}")
    public ResponseEntity<SegmentationDto> updateSegmentation(
            @PathVariable Long id,
            @RequestBody SegmentationDto dto) {
        log.info("Updating segmentation: {}", id);

        try {
            Segmentation updated = segmentationService.updateSegmentation(id, dto);
            return ResponseEntity.ok(toDto(updated));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating segmentation", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get segmentations for a study
     */
    @GetMapping("/study/{studyUid}")
    public ResponseEntity<List<SegmentationDto>> getStudySegmentations(@PathVariable String studyUid) {
        log.info("Getting segmentations for study: {}", studyUid);

        List<SegmentationDto> segmentations = segmentationService.getSegmentationsForStudy(studyUid);
        return ResponseEntity.ok(segmentations);
    }

    /**
     * Get segmentations for a series
     */
    @GetMapping("/study/{studyUid}/series/{seriesUid}")
    public ResponseEntity<List<SegmentationDto>> getSeriesSegmentations(
            @PathVariable String studyUid,
            @PathVariable String seriesUid) {
        log.info("Getting segmentations for series: {}", seriesUid);

        List<SegmentationDto> segmentations = segmentationService.getSegmentationsForSeries(studyUid, seriesUid);
        return ResponseEntity.ok(segmentations);
    }

    /**
     * Get a segmentation with mask data
     */
    @GetMapping("/{id}")
    public ResponseEntity<SegmentationDto> getSegmentation(@PathVariable Long id) {
        log.info("Getting segmentation: {}", id);

        try {
            SegmentationDto segmentation = segmentationService.getSegmentationWithMasks(id);
            return ResponseEntity.ok(segmentation);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Delete a segmentation
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteSegmentation(@PathVariable Long id) {
        log.info("Deleting segmentation: {}", id);

        try {
            segmentationService.deleteSegmentation(id);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            log.error("Error deleting segmentation", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Calculate volume for a segmentation
     */
    @GetMapping("/{id}/volume")
    public ResponseEntity<Map<String, Object>> calculateVolume(@PathVariable Long id) {
        log.info("Calculating volume for segmentation: {}", id);

        try {
            double volumeMm3 = segmentationService.calculateVolume(id);
            double volumeMl = volumeMm3 / 1000.0;
            double volumeCm3 = volumeMm3 / 1000.0;

            return ResponseEntity.ok(Map.of(
                "volumeMm3", volumeMm3,
                "volumeMl", volumeMl,
                "volumeCm3", volumeCm3,
                "volumeFormatted", String.format("%.2f cm³", volumeCm3)
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error calculating volume", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Export segmentation to DICOM SEG format
     */
    @PostMapping("/{id}/export-seg")
    public ResponseEntity<Map<String, String>> exportToDicomSeg(
            @PathVariable Long id,
            @RequestParam(required = false) String pacsNode) {
        log.info("Exporting segmentation {} to DICOM SEG", id);

        try {
            String segSopInstanceUid = segmentationService.exportToDicomSeg(id, pacsNode);

            return ResponseEntity.ok(Map.of(
                "segSopInstanceUid", segSopInstanceUid,
                "message", "Segmentation exported as DICOM SEG successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error exporting to DICOM SEG", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Export multiple segmentations to a single DICOM SEG
     */
    @PostMapping("/export-seg")
    public ResponseEntity<Map<String, String>> exportMultipleToDicomSeg(
            @RequestBody ExportSegRequest request) {
        log.info("Exporting {} segmentations to DICOM SEG", request.getSegmentationIds().size());

        try {
            String segSopInstanceUid = segmentationService.exportMultipleToDicomSeg(
                request.getSegmentationIds(), request.getPacsNode());

            return ResponseEntity.ok(Map.of(
                "segSopInstanceUid", segSopInstanceUid,
                "message", "Segmentations exported as DICOM SEG successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.badRequest().body(Map.of(
                "error", e.getMessage()
            ));
        } catch (Exception e) {
            log.error("Error exporting to DICOM SEG", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    /**
     * Request body for exporting multiple segmentations
     */
    @lombok.Data
    public static class ExportSegRequest {
        private List<Long> segmentationIds;
        private String pacsNode;
    }

    private SegmentationDto toDto(Segmentation segmentation) {
        return SegmentationDto.builder()
            .id(segmentation.getId())
            .studyInstanceUid(segmentation.getStudyInstanceUid())
            .seriesInstanceUid(segmentation.getSeriesInstanceUid())
            .sopInstanceUid(segmentation.getSopInstanceUid())
            .referencedSeriesUid(segmentation.getReferencedSeriesUid())
            .segmentLabel(segmentation.getSegmentLabel())
            .segmentDescription(segmentation.getSegmentDescription())
            .segmentAlgorithmType(segmentation.getSegmentAlgorithmType())
            .segmentAlgorithmName(segmentation.getSegmentAlgorithmName())
            .segmentCategory(segmentation.getSegmentCategory())
            .segmentType(segmentation.getSegmentType())
            .segmentNumber(segmentation.getSegmentNumber())
            .segmentColor(segmentation.getSegmentColor())
            .segmentOpacity(segmentation.getSegmentOpacity())
            .totalFrames(segmentation.getTotalFrames())
            .rows(segmentation.getRows())
            .columns(segmentation.getColumns())
            .volumeMm3(segmentation.getVolumeMm3())
            .surfaceAreaMm2(segmentation.getSurfaceAreaMm2())
            .createdAt(segmentation.getCreatedAt())
            .createdBy(segmentation.getCreatedBy())
            .modifiedAt(segmentation.getModifiedAt())
            .modifiedBy(segmentation.getModifiedBy())
            .exportedToSeg(segmentation.isExportedToSeg())
            .segSopInstanceUid(segmentation.getSegSopInstanceUid())
            .build();
    }
}

