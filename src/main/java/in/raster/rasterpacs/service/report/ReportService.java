package in.raster.rasterpacs.service.report;

import in.raster.rasterpacs.dto.ReportDto;
import in.raster.rasterpacs.dto.ReportTemplateDto;
import in.raster.rasterpacs.model.Report;
import in.raster.rasterpacs.model.ReportTemplate;
import in.raster.rasterpacs.repository.ReportRepository;
import in.raster.rasterpacs.repository.ReportTemplateRepository;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import in.raster.rasterpacs.service.pacs.DicomStoreService;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.*;
import org.dcm4che3.io.DicomOutputStream;
import org.dcm4che3.util.UIDUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;

/**
 * Service for managing radiology reports
 */
@Slf4j
@Service
public class ReportService {

    private final ReportRepository reportRepository;
    private final ReportTemplateRepository templateRepository;
    private final DicomCacheService cacheService;
    private final DicomStoreService storeService;
    private final PdfExportService pdfExportService;
    private final ObjectMapper objectMapper;

    private static final DateTimeFormatter DICOM_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DICOM_TIME = DateTimeFormatter.ofPattern("HHmmss");

    public ReportService(
            ReportRepository reportRepository,
            ReportTemplateRepository templateRepository,
            DicomCacheService cacheService,
            DicomStoreService storeService,
            PdfExportService pdfExportService,
            ObjectMapper objectMapper) {
        this.reportRepository = reportRepository;
        this.templateRepository = templateRepository;
        this.cacheService = cacheService;
        this.storeService = storeService;
        this.pdfExportService = pdfExportService;
        this.objectMapper = objectMapper;
    }

    // ==================== Report CRUD Operations ====================

    @Transactional
    public Report createReport(ReportDto dto) {
        log.info("Creating report for study: {}", dto.getStudyInstanceUid());

        Report report = new Report();
        updateReportFromDto(report, dto);
        report.setStatus("DRAFT");
        report.setVersion(1);

        return reportRepository.save(report);
    }

    @Transactional
    public Report updateReport(Long id, ReportDto dto) {
        Report report = reportRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + id));

        if ("FINAL".equals(report.getStatus()) || "SIGNED".equals(report.getStatus())) {
            throw new IllegalStateException("Cannot modify a finalized report");
        }

        updateReportFromDto(report, dto);
        return reportRepository.save(report);
    }

    @Transactional
    public Report saveAsDraft(Long id, ReportDto dto) {
        Report report;
        if (id != null) {
            report = reportRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Report not found: " + id));
        } else {
            report = new Report();
            report.setVersion(1);
        }

        updateReportFromDto(report, dto);
        report.setStatus("DRAFT");
        return reportRepository.save(report);
    }

    @Transactional
    public Report signReport(Long id, String signedBy, String digitalSignature) {
        Report report = reportRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + id));

        report.setStatus("FINAL");
        report.setSignedAt(LocalDateTime.now());
        report.setSignedBy(signedBy);
        report.setDigitalSignature(digitalSignature);

        return reportRepository.save(report);
    }

    @Transactional
    public Report amendReport(Long originalId, ReportDto dto, String amendedBy) {
        Report original = reportRepository.findById(originalId)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + originalId));

        // Create new version
        Report amended = new Report();
        updateReportFromDto(amended, dto);
        amended.setReportType("ADDENDUM");
        amended.setStatus("DRAFT");
        amended.setVersion(original.getVersion() + 1);
        amended.setPreviousVersionId(original.getId().toString());
        amended.setCreatedBy(amendedBy);

        return reportRepository.save(amended);
    }

    public ReportDto getReport(Long id) {
        Report report = reportRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + id));
        return toDto(report);
    }

    public List<ReportDto> getReportsForStudy(String studyInstanceUid) {
        return reportRepository.findByStudyInstanceUid(studyInstanceUid)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<ReportDto> getDraftsByUser(String userId) {
        return reportRepository.findDraftsByUser(userId)
            .stream()
            .map(this::toDto)
            .toList();
    }

    public List<ReportDto> getPendingReports() {
        return reportRepository.findPendingReports()
            .stream()
            .map(this::toDto)
            .toList();
    }

    @Transactional
    public void deleteReport(Long id) {
        Report report = reportRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + id));

        if ("FINAL".equals(report.getStatus()) || "SIGNED".equals(report.getStatus())) {
            throw new IllegalStateException("Cannot delete a finalized report");
        }

        reportRepository.delete(report);
    }

    // ==================== Template Operations ====================

    public List<ReportTemplateDto> getAllTemplates() {
        return templateRepository.findByIsActiveTrueOrderBySortOrderAsc()
            .stream()
            .map(this::toTemplateDto)
            .toList();
    }

    public List<ReportTemplateDto> getTemplatesByModality(String modality) {
        return templateRepository.findByModalityAndIsActiveTrue(modality)
            .stream()
            .map(this::toTemplateDto)
            .toList();
    }

    public ReportTemplateDto getTemplate(String templateId) {
        ReportTemplate template = templateRepository.findByTemplateId(templateId)
            .orElseThrow(() -> new IllegalArgumentException("Template not found: " + templateId));
        return toTemplateDto(template);
    }

    @Transactional
    public ReportTemplate createTemplate(ReportTemplateDto dto) {
        ReportTemplate template = new ReportTemplate();
        updateTemplateFromDto(template, dto);
        template.setActive(true);
        return templateRepository.save(template);
    }

    @Transactional
    public ReportTemplate updateTemplate(String templateId, ReportTemplateDto dto) {
        ReportTemplate template = templateRepository.findByTemplateId(templateId)
            .orElseThrow(() -> new IllegalArgumentException("Template not found: " + templateId));
        updateTemplateFromDto(template, dto);
        return templateRepository.save(template);
    }

    @Transactional
    public void deleteTemplate(String templateId) {
        ReportTemplate template = templateRepository.findByTemplateId(templateId)
            .orElseThrow(() -> new IllegalArgumentException("Template not found: " + templateId));
        template.setActive(false);
        templateRepository.save(template);
    }

    // ==================== Export Operations ====================

    public byte[] exportToPdf(Long reportId) throws IOException {
        Report report = reportRepository.findById(reportId)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + reportId));

        ReportDto dto = toDto(report);
        return pdfExportService.generatePdf(dto);
    }

    @Transactional
    public String exportToDicomSr(Long reportId, String pacsNode) throws IOException {
        Report report = reportRepository.findById(reportId)
            .orElseThrow(() -> new IllegalArgumentException("Report not found: " + reportId));

        log.info("Exporting report {} to DICOM SR", reportId);

        // Get reference image for patient info
        File refFile = getFirstCachedInstance(report.getStudyInstanceUid());
        Attributes refAttrs = null;
        if (refFile != null) {
            refAttrs = cacheService.readDicomAttributes(refFile);
        }

        // Create DICOM SR
        Attributes srDataset = createTextSR(report, refAttrs);

        // Generate SOP Instance UID
        String srSopInstanceUid = UIDUtils.createUID();
        srDataset.setString(Tag.SOPInstanceUID, VR.UI, srSopInstanceUid);

        // Encode and store
        byte[] srBytes = encodeDicom(srDataset);
        File srFile = cacheService.storeStructuredReport(report.getStudyInstanceUid(), srSopInstanceUid, srBytes);

        // Store to PACS if requested
        if (pacsNode != null && !pacsNode.isEmpty()) {
            storeService.storeToPacs(srFile, pacsNode);
        }

        // Update report record
        report.setExportedToSr(true);
        report.setSrSopInstanceUid(srSopInstanceUid);
        reportRepository.save(report);

        log.info("Created DICOM SR with SOP Instance UID: {}", srSopInstanceUid);
        return srSopInstanceUid;
    }

    // ==================== Statistics ====================

    public Map<String, Object> getReportStatistics() {
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime startOfDay = now.toLocalDate().atStartOfDay();
        LocalDateTime startOfWeek = now.minusDays(7);
        LocalDateTime startOfMonth = now.minusDays(30);

        Map<String, Object> stats = new HashMap<>();
        stats.put("totalReports", reportRepository.count());
        stats.put("draftReports", reportRepository.countByStatus("DRAFT"));
        stats.put("preliminaryReports", reportRepository.countByStatus("PRELIMINARY"));
        stats.put("finalReports", reportRepository.countByStatus("FINAL"));
        stats.put("reportsToday", reportRepository.countByCreatedAtBetween(startOfDay, now));
        stats.put("reportsThisWeek", reportRepository.countByCreatedAtBetween(startOfWeek, now));
        stats.put("reportsThisMonth", reportRepository.countByCreatedAtBetween(startOfMonth, now));

        return stats;
    }

    // ==================== DICOM SR Creation ====================

    private Attributes createTextSR(Report report, Attributes refAttrs) {
        Attributes sr = new Attributes();
        LocalDateTime now = LocalDateTime.now();

        // Patient Module
        if (refAttrs != null) {
            sr.setString(Tag.PatientName, VR.PN, refAttrs.getString(Tag.PatientName, report.getPatientName()));
            sr.setString(Tag.PatientID, VR.LO, refAttrs.getString(Tag.PatientID, report.getPatientId()));
            sr.setString(Tag.PatientBirthDate, VR.DA, refAttrs.getString(Tag.PatientBirthDate, ""));
            sr.setString(Tag.PatientSex, VR.CS, refAttrs.getString(Tag.PatientSex, ""));
        } else {
            sr.setString(Tag.PatientName, VR.PN, report.getPatientName() != null ? report.getPatientName() : "UNKNOWN");
            sr.setString(Tag.PatientID, VR.LO, report.getPatientId() != null ? report.getPatientId() : "UNKNOWN");
        }

        // General Study Module
        sr.setString(Tag.StudyInstanceUID, VR.UI, report.getStudyInstanceUid());
        if (refAttrs != null) {
            sr.setString(Tag.StudyDate, VR.DA, refAttrs.getString(Tag.StudyDate, ""));
            sr.setString(Tag.StudyTime, VR.TM, refAttrs.getString(Tag.StudyTime, ""));
            sr.setString(Tag.AccessionNumber, VR.SH, refAttrs.getString(Tag.AccessionNumber, report.getAccessionNumber()));
            sr.setString(Tag.ReferringPhysicianName, VR.PN, report.getReferringPhysician());
            sr.setString(Tag.StudyID, VR.SH, refAttrs.getString(Tag.StudyID, ""));
        }

        // SR Document Series Module
        String srSeriesUid = UIDUtils.createUID();
        sr.setString(Tag.SeriesInstanceUID, VR.UI, srSeriesUid);
        sr.setString(Tag.SeriesNumber, VR.IS, "9999");
        sr.setString(Tag.SeriesDescription, VR.LO, "Radiology Report");
        sr.setString(Tag.Modality, VR.CS, "SR");
        sr.setString(Tag.SeriesDate, VR.DA, now.format(DICOM_DATE));
        sr.setString(Tag.SeriesTime, VR.TM, now.format(DICOM_TIME));

        // General Equipment Module
        sr.setString(Tag.Manufacturer, VR.LO, "Raster PACS");
        sr.setString(Tag.InstitutionName, VR.LO, report.getInstitutionName());
        sr.setString(Tag.SoftwareVersions, VR.LO, "2.0");

        // SR Document General Module
        sr.setString(Tag.ContentDate, VR.DA, now.format(DICOM_DATE));
        sr.setString(Tag.ContentTime, VR.TM, now.format(DICOM_TIME));
        sr.setString(Tag.InstanceNumber, VR.IS, "1");

        String completionFlag = "FINAL".equals(report.getStatus()) ? "COMPLETE" : "PARTIAL";
        sr.setString(Tag.CompletionFlag, VR.CS, completionFlag);

        String verificationFlag = report.getSignedBy() != null ? "VERIFIED" : "UNVERIFIED";
        sr.setString(Tag.VerificationFlag, VR.CS, verificationFlag);

        // SOP Common Module
        sr.setString(Tag.SOPClassUID, VR.UI, UID.BasicTextSRStorage);
        sr.setString(Tag.SpecificCharacterSet, VR.CS, "ISO_IR 100");

        // Concept Name Code Sequence (Document Title)
        Attributes titleCode = new Attributes();
        titleCode.setString(Tag.CodeValue, VR.SH, "18782-3");
        titleCode.setString(Tag.CodingSchemeDesignator, VR.SH, "LN");
        titleCode.setString(Tag.CodeMeaning, VR.LO, "Radiology Study observation");
        sr.newSequence(Tag.ConceptNameCodeSequence, 1).add(titleCode);

        // Content Sequence
        Sequence contentSeq = sr.newSequence(Tag.ContentSequence, 10);

        // Add report sections
        if (report.getClinicalHistory() != null && !report.getClinicalHistory().isEmpty()) {
            contentSeq.add(createTextContentItem("121060", "DCM", "History", report.getClinicalHistory()));
        }

        if (report.getTechnique() != null && !report.getTechnique().isEmpty()) {
            contentSeq.add(createTextContentItem("121064", "DCM", "Current Procedure Descriptions", report.getTechnique()));
        }

        if (report.getComparison() != null && !report.getComparison().isEmpty()) {
            contentSeq.add(createTextContentItem("121065", "DCM", "Procedure Code", report.getComparison()));
        }

        if (report.getFindings() != null && !report.getFindings().isEmpty()) {
            contentSeq.add(createTextContentItem("121070", "DCM", "Findings", report.getFindings()));
        }

        if (report.getImpression() != null && !report.getImpression().isEmpty()) {
            contentSeq.add(createTextContentItem("121073", "DCM", "Impression", report.getImpression()));
        }

        if (report.getRecommendations() != null && !report.getRecommendations().isEmpty()) {
            contentSeq.add(createTextContentItem("121074", "DCM", "Recommendation", report.getRecommendations()));
        }

        // Verifying Observer Sequence (if signed)
        if (report.getSignedBy() != null) {
            Sequence verifyingSeq = sr.newSequence(Tag.VerifyingObserverSequence, 1);
            Attributes verifying = new Attributes();
            verifying.setString(Tag.VerifyingObserverName, VR.PN, report.getSignedBy());
            verifying.setString(Tag.VerificationDateTime, VR.DT,
                report.getSignedAt() != null ? report.getSignedAt().format(DateTimeFormatter.ofPattern("yyyyMMddHHmmss")) : "");
            verifying.setString(Tag.VerifyingOrganization, VR.LO, report.getInstitutionName());
            verifyingSeq.add(verifying);
        }

        return sr;
    }

    private Attributes createTextContentItem(String codeValue, String codingScheme, String codeMeaning, String text) {
        Attributes item = new Attributes();
        item.setString(Tag.RelationshipType, VR.CS, "CONTAINS");
        item.setString(Tag.ValueType, VR.CS, "TEXT");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, codeValue);
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, codingScheme);
        conceptCode.setString(Tag.CodeMeaning, VR.LO, codeMeaning);
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        item.setString(Tag.TextValue, VR.UT, text);

        return item;
    }

    // ==================== Helper Methods ====================

    private void updateReportFromDto(Report report, ReportDto dto) {
        report.setStudyInstanceUid(dto.getStudyInstanceUid());
        report.setAccessionNumber(dto.getAccessionNumber());
        report.setPatientId(dto.getPatientId());
        report.setPatientName(dto.getPatientName());
        report.setTemplateId(dto.getTemplateId());
        report.setTemplateName(dto.getTemplateName());
        report.setReportType(dto.getReportType());
        report.setTitle(dto.getTitle());
        report.setClinicalHistory(dto.getClinicalHistory());
        report.setTechnique(dto.getTechnique());
        report.setComparison(dto.getComparison());
        report.setFindings(dto.getFindings());
        report.setImpression(dto.getImpression());
        report.setRecommendations(dto.getRecommendations());
        report.setAdditionalComments(dto.getAdditionalComments());
        report.setReportingPhysician(dto.getReportingPhysician());
        report.setReferringPhysician(dto.getReferringPhysician());
        report.setInstitutionName(dto.getInstitutionName());
        report.setPriority(dto.getPriority());
        report.setStudyDate(dto.getStudyDate());
        report.setModifiedBy(dto.getModifiedBy());

        // Serialize structured data
        try {
            if (dto.getStructuredFindings() != null) {
                report.setStructuredData(objectMapper.writeValueAsString(dto.getStructuredFindings()));
            }
            if (dto.getMeasurements() != null) {
                report.setMeasurementsJson(objectMapper.writeValueAsString(dto.getMeasurements()));
            }
            if (dto.getKeyImages() != null) {
                report.setKeyImagesJson(objectMapper.writeValueAsString(dto.getKeyImages()));
            }
        } catch (JsonProcessingException e) {
            log.error("Error serializing report data", e);
        }
    }

    private void updateTemplateFromDto(ReportTemplate template, ReportTemplateDto dto) {
        template.setTemplateId(dto.getTemplateId());
        template.setName(dto.getName());
        template.setDescription(dto.getDescription());
        template.setCategory(dto.getCategory());
        template.setModality(dto.getModality());
        template.setBodyPart(dto.getBodyPart());
        template.setProcedureCode(dto.getProcedureCode());
        template.setDefaultFindings(dto.getDefaultFindings());
        template.setDefaultImpression(dto.getDefaultImpression());
        template.setDefaultTechnique(dto.getDefaultTechnique());
        template.setSortOrder(dto.getSortOrder());

        try {
            if (dto.getSections() != null) {
                template.setTemplateContent(objectMapper.writeValueAsString(dto.getSections()));
            }
            if (dto.getStructuredFields() != null) {
                template.setStructuredFields(objectMapper.writeValueAsString(dto.getStructuredFields()));
            }
            if (dto.getMacros() != null) {
                template.setMacros(objectMapper.writeValueAsString(dto.getMacros()));
            }
        } catch (JsonProcessingException e) {
            log.error("Error serializing template data", e);
        }
    }

    private ReportDto toDto(Report report) {
        ReportDto dto = ReportDto.builder()
            .id(report.getId())
            .studyInstanceUid(report.getStudyInstanceUid())
            .accessionNumber(report.getAccessionNumber())
            .patientId(report.getPatientId())
            .patientName(report.getPatientName())
            .templateId(report.getTemplateId())
            .templateName(report.getTemplateName())
            .reportType(report.getReportType())
            .status(report.getStatus())
            .title(report.getTitle())
            .clinicalHistory(report.getClinicalHistory())
            .technique(report.getTechnique())
            .comparison(report.getComparison())
            .findings(report.getFindings())
            .impression(report.getImpression())
            .recommendations(report.getRecommendations())
            .additionalComments(report.getAdditionalComments())
            .reportingPhysician(report.getReportingPhysician())
            .referringPhysician(report.getReferringPhysician())
            .institutionName(report.getInstitutionName())
            .priority(report.getPriority())
            .studyDate(report.getStudyDate())
            .createdAt(report.getCreatedAt())
            .createdBy(report.getCreatedBy())
            .modifiedAt(report.getModifiedAt())
            .modifiedBy(report.getModifiedBy())
            .signedAt(report.getSignedAt())
            .signedBy(report.getSignedBy())
            .exportedToPdf(report.isExportedToPdf())
            .pdfFilePath(report.getPdfFilePath())
            .exportedToSr(report.isExportedToSr())
            .srSopInstanceUid(report.getSrSopInstanceUid())
            .version(report.getVersion())
            .build();

        // Deserialize structured data
        try {
            if (report.getStructuredData() != null) {
                dto.setStructuredFindings(objectMapper.readValue(report.getStructuredData(),
                    new TypeReference<List<ReportDto.StructuredFinding>>() {}));
            }
            if (report.getMeasurementsJson() != null) {
                dto.setMeasurements(objectMapper.readValue(report.getMeasurementsJson(),
                    new TypeReference<List<ReportDto.Measurement>>() {}));
            }
            if (report.getKeyImagesJson() != null) {
                dto.setKeyImages(objectMapper.readValue(report.getKeyImagesJson(),
                    new TypeReference<List<ReportDto.KeyImage>>() {}));
            }
        } catch (JsonProcessingException e) {
            log.error("Error deserializing report data", e);
        }

        return dto;
    }

    private ReportTemplateDto toTemplateDto(ReportTemplate template) {
        ReportTemplateDto dto = ReportTemplateDto.builder()
            .id(template.getId())
            .templateId(template.getTemplateId())
            .name(template.getName())
            .description(template.getDescription())
            .category(template.getCategory())
            .modality(template.getModality())
            .bodyPart(template.getBodyPart())
            .procedureCode(template.getProcedureCode())
            .defaultFindings(template.getDefaultFindings())
            .defaultImpression(template.getDefaultImpression())
            .defaultTechnique(template.getDefaultTechnique())
            .isActive(template.isActive())
            .isDefault(template.isDefault())
            .sortOrder(template.getSortOrder())
            .createdBy(template.getCreatedBy())
            .createdAt(template.getCreatedAt())
            .build();

        try {
            if (template.getTemplateContent() != null) {
                dto.setSections(objectMapper.readValue(template.getTemplateContent(),
                    new TypeReference<List<ReportTemplateDto.TemplateSection>>() {}));
            }
            if (template.getStructuredFields() != null) {
                dto.setStructuredFields(objectMapper.readValue(template.getStructuredFields(),
                    new TypeReference<List<ReportTemplateDto.StructuredField>>() {}));
            }
            if (template.getMacros() != null) {
                dto.setMacros(objectMapper.readValue(template.getMacros(),
                    new TypeReference<List<ReportTemplateDto.TextMacro>>() {}));
            }
        } catch (JsonProcessingException e) {
            log.error("Error deserializing template data", e);
        }

        return dto;
    }

    private File getFirstCachedInstance(String studyUid) {
        // Get any series from the study
        List<File> instances = cacheService.getCachedSeriesInstances(studyUid, null);
        return instances.isEmpty() ? null : instances.get(0);
    }

    private byte[] encodeDicom(Attributes dataset) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (DicomOutputStream dos = new DicomOutputStream(baos, UID.ExplicitVRLittleEndian)) {
            Attributes fmi = dataset.createFileMetaInformation(UID.ExplicitVRLittleEndian);
            dos.writeDataset(fmi, dataset);
        }
        return baos.toByteArray();
    }
}

