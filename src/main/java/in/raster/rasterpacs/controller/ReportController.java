package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.dto.ReportDto;
import in.raster.rasterpacs.dto.ReportTemplateDto;
import in.raster.rasterpacs.model.Report;
import in.raster.rasterpacs.model.ReportTemplate;
import in.raster.rasterpacs.service.report.PdfExportService;
import in.raster.rasterpacs.service.report.ReportService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for managing radiology reports
 */
@Slf4j
@RestController
@RequestMapping("/api/reports")
@CrossOrigin(origins = "*")
public class ReportController {

    private final ReportService reportService;
    private final PdfExportService pdfExportService;

    public ReportController(ReportService reportService, PdfExportService pdfExportService) {
        this.reportService = reportService;
        this.pdfExportService = pdfExportService;
    }

    // ==================== Report CRUD ====================

    /**
     * Create a new report
     */
    @PostMapping
    public ResponseEntity<ReportDto> createReport(@RequestBody ReportDto dto) {
        log.info("Creating report for study: {}", dto.getStudyInstanceUid());

        try {
            Report report = reportService.createReport(dto);
            return ResponseEntity.status(HttpStatus.CREATED).body(reportService.getReport(report.getId()));
        } catch (Exception e) {
            log.error("Error creating report", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update an existing report
     */
    @PutMapping("/{id}")
    public ResponseEntity<ReportDto> updateReport(@PathVariable Long id, @RequestBody ReportDto dto) {
        log.info("Updating report: {}", id);

        try {
            Report report = reportService.updateReport(id, dto);
            return ResponseEntity.ok(reportService.getReport(report.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        } catch (Exception e) {
            log.error("Error updating report", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Save report as draft
     */
    @PostMapping("/draft")
    public ResponseEntity<ReportDto> saveAsDraft(
            @RequestParam(required = false) Long id,
            @RequestBody ReportDto dto) {
        log.info("Saving report as draft: {}", id);

        try {
            Report report = reportService.saveAsDraft(id, dto);
            return ResponseEntity.ok(reportService.getReport(report.getId()));
        } catch (Exception e) {
            log.error("Error saving draft", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Sign and finalize a report
     */
    @PostMapping("/{id}/sign")
    public ResponseEntity<ReportDto> signReport(
            @PathVariable Long id,
            @RequestBody SignRequest request) {
        log.info("Signing report: {}", id);

        try {
            Report report = reportService.signReport(id, request.getSignedBy(), request.getDigitalSignature());
            return ResponseEntity.ok(reportService.getReport(report.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error signing report", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Amend a finalized report
     */
    @PostMapping("/{id}/amend")
    public ResponseEntity<ReportDto> amendReport(
            @PathVariable Long id,
            @RequestBody ReportDto dto) {
        log.info("Amending report: {}", id);

        try {
            Report report = reportService.amendReport(id, dto, dto.getModifiedBy());
            return ResponseEntity.ok(reportService.getReport(report.getId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error amending report", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get a report by ID
     */
    @GetMapping("/{id}")
    public ResponseEntity<ReportDto> getReport(@PathVariable Long id) {
        try {
            ReportDto report = reportService.getReport(id);
            return ResponseEntity.ok(report);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Get reports for a study
     */
    @GetMapping("/study/{studyUid}")
    public ResponseEntity<List<ReportDto>> getStudyReports(@PathVariable String studyUid) {
        List<ReportDto> reports = reportService.getReportsForStudy(studyUid);
        return ResponseEntity.ok(reports);
    }

    /**
     * Get drafts for a user
     */
    @GetMapping("/drafts")
    public ResponseEntity<List<ReportDto>> getUserDrafts(@RequestParam String userId) {
        List<ReportDto> drafts = reportService.getDraftsByUser(userId);
        return ResponseEntity.ok(drafts);
    }

    /**
     * Get pending reports
     */
    @GetMapping("/pending")
    public ResponseEntity<List<ReportDto>> getPendingReports() {
        List<ReportDto> pending = reportService.getPendingReports();
        return ResponseEntity.ok(pending);
    }

    /**
     * Delete a report
     */
    @DeleteMapping("/{id}")
    public ResponseEntity<Void> deleteReport(@PathVariable Long id) {
        log.info("Deleting report: {}", id);

        try {
            reportService.deleteReport(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (IllegalStateException e) {
            return ResponseEntity.status(HttpStatus.CONFLICT).build();
        } catch (Exception e) {
            log.error("Error deleting report", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    // ==================== Export ====================

    /**
     * Export report to PDF
     */
    @GetMapping("/{id}/pdf")
    public ResponseEntity<byte[]> exportToPdf(@PathVariable Long id) {
        log.info("Exporting report {} to PDF", id);

        try {
            byte[] pdfBytes = reportService.exportToPdf(id);

            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.TEXT_HTML);
            headers.setContentDisposition(ContentDisposition.builder("attachment")
                .filename("report_" + id + ".html")
                .build());

            return new ResponseEntity<>(pdfBytes, headers, HttpStatus.OK);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error exporting PDF", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Get printable HTML version
     */
    @GetMapping("/{id}/print")
    public ResponseEntity<String> getPrintableReport(@PathVariable Long id) {
        try {
            ReportDto report = reportService.getReport(id);
            String html = pdfExportService.generateHtml(report);

            return ResponseEntity.ok()
                .contentType(MediaType.TEXT_HTML)
                .body(html);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Export report to DICOM SR
     */
    @PostMapping("/{id}/export-sr")
    public ResponseEntity<Map<String, String>> exportToDicomSr(
            @PathVariable Long id,
            @RequestParam(required = false) String pacsNode) {
        log.info("Exporting report {} to DICOM SR", id);

        try {
            String srSopInstanceUid = reportService.exportToDicomSr(id, pacsNode);

            return ResponseEntity.ok(Map.of(
                "srSopInstanceUid", srSopInstanceUid,
                "message", "Report exported as DICOM SR successfully"
            ));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error exporting to DICOM SR", e);
            return ResponseEntity.internalServerError().body(Map.of(
                "error", e.getMessage()
            ));
        }
    }

    // ==================== Templates ====================

    /**
     * Get all active templates
     */
    @GetMapping("/templates")
    public ResponseEntity<List<ReportTemplateDto>> getAllTemplates() {
        List<ReportTemplateDto> templates = reportService.getAllTemplates();
        return ResponseEntity.ok(templates);
    }

    /**
     * Get templates by modality
     */
    @GetMapping("/templates/modality/{modality}")
    public ResponseEntity<List<ReportTemplateDto>> getTemplatesByModality(@PathVariable String modality) {
        List<ReportTemplateDto> templates = reportService.getTemplatesByModality(modality);
        return ResponseEntity.ok(templates);
    }

    /**
     * Get a template by ID
     */
    @GetMapping("/templates/{templateId}")
    public ResponseEntity<ReportTemplateDto> getTemplate(@PathVariable String templateId) {
        try {
            ReportTemplateDto template = reportService.getTemplate(templateId);
            return ResponseEntity.ok(template);
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    /**
     * Create a new template
     */
    @PostMapping("/templates")
    public ResponseEntity<ReportTemplateDto> createTemplate(@RequestBody ReportTemplateDto dto) {
        log.info("Creating template: {}", dto.getName());

        try {
            ReportTemplate template = reportService.createTemplate(dto);
            return ResponseEntity.status(HttpStatus.CREATED)
                .body(reportService.getTemplate(template.getTemplateId()));
        } catch (Exception e) {
            log.error("Error creating template", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Update a template
     */
    @PutMapping("/templates/{templateId}")
    public ResponseEntity<ReportTemplateDto> updateTemplate(
            @PathVariable String templateId,
            @RequestBody ReportTemplateDto dto) {
        log.info("Updating template: {}", templateId);

        try {
            ReportTemplate template = reportService.updateTemplate(templateId, dto);
            return ResponseEntity.ok(reportService.getTemplate(template.getTemplateId()));
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        } catch (Exception e) {
            log.error("Error updating template", e);
            return ResponseEntity.internalServerError().build();
        }
    }

    /**
     * Delete (deactivate) a template
     */
    @DeleteMapping("/templates/{templateId}")
    public ResponseEntity<Void> deleteTemplate(@PathVariable String templateId) {
        log.info("Deleting template: {}", templateId);

        try {
            reportService.deleteTemplate(templateId);
            return ResponseEntity.noContent().build();
        } catch (IllegalArgumentException e) {
            return ResponseEntity.notFound().build();
        }
    }

    // ==================== Statistics ====================

    /**
     * Get report statistics
     */
    @GetMapping("/stats")
    public ResponseEntity<Map<String, Object>> getStatistics() {
        Map<String, Object> stats = reportService.getReportStatistics();
        return ResponseEntity.ok(stats);
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    public static class SignRequest {
        private String signedBy;
        private String digitalSignature;
    }
}

