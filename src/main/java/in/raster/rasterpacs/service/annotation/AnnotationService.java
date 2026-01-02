package in.raster.rasterpacs.service.annotation;

import in.raster.rasterpacs.dto.AnnotationDto;
import in.raster.rasterpacs.model.Annotation;
import in.raster.rasterpacs.repository.AnnotationRepository;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import in.raster.rasterpacs.service.pacs.DicomStoreService;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.*;
import org.dcm4che3.io.DicomOutputStream;
import org.dcm4che3.util.UIDUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;
import java.util.stream.Collectors;

/**
 * Service for managing DICOM annotations and converting them to DICOM SR
 */
@Slf4j
@Service
public class AnnotationService {

    private final AnnotationRepository annotationRepository;
    private final DicomCacheService cacheService;
    private final DicomStoreService storeService;

    private static final DateTimeFormatter DICOM_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DICOM_TIME = DateTimeFormatter.ofPattern("HHmmss");

    private static final String SR_TITLE_IMAGING_MEASUREMENT = "Imaging Measurement Report";

    public AnnotationService(
            AnnotationRepository annotationRepository,
            DicomCacheService cacheService,
            DicomStoreService storeService) {
        this.annotationRepository = annotationRepository;
        this.cacheService = cacheService;
        this.storeService = storeService;
    }

    @Transactional
    public Annotation saveAnnotation(AnnotationDto dto) {
        Annotation annotation = new Annotation();
        annotation.setStudyInstanceUid(dto.getStudyInstanceUid());
        annotation.setSeriesInstanceUid(dto.getSeriesInstanceUid());
        annotation.setSopInstanceUid(dto.getSopInstanceUid());
        annotation.setFrameNumber(dto.getFrameNumber());
        annotation.setAnnotationType(dto.getAnnotationType());
        annotation.setData(dto.getData());
        annotation.setLabel(dto.getLabel());
        annotation.setCreatedAt(LocalDateTime.now());
        annotation.setCreatedBy(dto.getCreatedBy());
        return annotationRepository.save(annotation);
    }

    public List<AnnotationDto> getAnnotationsForStudy(String studyInstanceUid) {
        return annotationRepository.findByStudyInstanceUid(studyInstanceUid)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<AnnotationDto> getAnnotationsForSeries(String studyInstanceUid, String seriesInstanceUid) {
        return annotationRepository.findByStudyInstanceUidAndSeriesInstanceUid(studyInstanceUid, seriesInstanceUid)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    public List<AnnotationDto> getAnnotationsForInstance(String studyInstanceUid, String seriesInstanceUid,
                                                          String sopInstanceUid) {
        return annotationRepository.findByStudyInstanceUidAndSeriesInstanceUidAndSopInstanceUid(
                        studyInstanceUid, seriesInstanceUid, sopInstanceUid)
                .stream()
                .map(this::toDto)
                .collect(Collectors.toList());
    }

    @Transactional
    public void deleteAnnotation(Long id) {
        annotationRepository.deleteById(id);
    }

    @Transactional
    public String saveAnnotationsAsDicomSR(String studyInstanceUid, String seriesInstanceUid,
                                           List<AnnotationDto> annotations, String pacsNode) throws IOException {
        log.info("Creating DICOM SR for {} annotations in study {}", annotations.size(), studyInstanceUid);

        File firstInstanceFile = null;
        Attributes refImageAttrs = null;

        if (!annotations.isEmpty()) {
            AnnotationDto firstAnnotation = annotations.get(0);
            firstInstanceFile = cacheService.getCachedFile(
                    firstAnnotation.getStudyInstanceUid(),
                    firstAnnotation.getSeriesInstanceUid(),
                    firstAnnotation.getSopInstanceUid()
            );
            if (firstInstanceFile != null) {
                refImageAttrs = cacheService.readDicomAttributes(firstInstanceFile);
            }
        }

        Attributes srDataset = createStructuredReport(studyInstanceUid, seriesInstanceUid,
                                                       annotations, refImageAttrs);

        String srSopInstanceUid = UIDUtils.createUID();
        srDataset.setString(Tag.SOPInstanceUID, VR.UI, srSopInstanceUid);

        byte[] srBytes = encodeDicom(srDataset);
        File srFile = cacheService.storeStructuredReport(studyInstanceUid, srSopInstanceUid, srBytes);

        if (pacsNode != null && !pacsNode.isEmpty()) {
            storeService.storeToPacs(srFile, pacsNode);
        }

        for (AnnotationDto dto : annotations) {
            if (dto.getId() != null) {
                Optional<Annotation> annotationOpt = annotationRepository.findById(dto.getId());
                annotationOpt.ifPresent(annotation -> {
                    annotation.setSrInstanceUid(srSopInstanceUid);
                    annotation.setSavedToSr(true);
                    annotationRepository.save(annotation);
                });
            }
        }

        log.info("Created DICOM SR with SOP Instance UID: {}", srSopInstanceUid);
        return srSopInstanceUid;
    }

    private Attributes createStructuredReport(String studyInstanceUid, String seriesInstanceUid,
                                               List<AnnotationDto> annotations, Attributes refImageAttrs) {
        Attributes sr = new Attributes();
        LocalDateTime now = LocalDateTime.now();

        // Patient Module
        if (refImageAttrs != null) {
            sr.setString(Tag.PatientName, VR.PN, refImageAttrs.getString(Tag.PatientName, "UNKNOWN"));
            sr.setString(Tag.PatientID, VR.LO, refImageAttrs.getString(Tag.PatientID, "UNKNOWN"));
            sr.setString(Tag.PatientBirthDate, VR.DA, refImageAttrs.getString(Tag.PatientBirthDate, ""));
            sr.setString(Tag.PatientSex, VR.CS, refImageAttrs.getString(Tag.PatientSex, ""));
        } else {
            sr.setString(Tag.PatientName, VR.PN, "UNKNOWN");
            sr.setString(Tag.PatientID, VR.LO, "UNKNOWN");
            sr.setString(Tag.PatientBirthDate, VR.DA, "");
            sr.setString(Tag.PatientSex, VR.CS, "");
        }

        // General Study Module
        sr.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);
        if (refImageAttrs != null) {
            sr.setString(Tag.StudyDate, VR.DA, refImageAttrs.getString(Tag.StudyDate, ""));
            sr.setString(Tag.StudyTime, VR.TM, refImageAttrs.getString(Tag.StudyTime, ""));
            sr.setString(Tag.AccessionNumber, VR.SH, refImageAttrs.getString(Tag.AccessionNumber, ""));
            sr.setString(Tag.ReferringPhysicianName, VR.PN, refImageAttrs.getString(Tag.ReferringPhysicianName, ""));
            sr.setString(Tag.StudyID, VR.SH, refImageAttrs.getString(Tag.StudyID, ""));
        }

        // SR Document Series Module
        String srSeriesUid = UIDUtils.createUID();
        sr.setString(Tag.SeriesInstanceUID, VR.UI, srSeriesUid);
        sr.setString(Tag.SeriesNumber, VR.IS, "999");
        sr.setString(Tag.SeriesDescription, VR.LO, "Imaging Measurements");
        sr.setString(Tag.Modality, VR.CS, "SR");
        sr.setString(Tag.SeriesDate, VR.DA, now.format(DICOM_DATE));
        sr.setString(Tag.SeriesTime, VR.TM, now.format(DICOM_TIME));

        // General Equipment Module
        sr.setString(Tag.Manufacturer, VR.LO, "Raster PACS");
        sr.setString(Tag.ManufacturerModelName, VR.LO, "Zero Footprint DICOM Viewer");
        sr.setString(Tag.SoftwareVersions, VR.LO, "2.0");

        // SR Document General Module
        sr.setString(Tag.ContentDate, VR.DA, now.format(DICOM_DATE));
        sr.setString(Tag.ContentTime, VR.TM, now.format(DICOM_TIME));
        sr.setString(Tag.InstanceNumber, VR.IS, "1");
        sr.setString(Tag.CompletionFlag, VR.CS, "COMPLETE");
        sr.setString(Tag.VerificationFlag, VR.CS, "UNVERIFIED");

        // SOP Common Module
        sr.setString(Tag.SOPClassUID, VR.UI, UID.ComprehensiveSRStorage);
        sr.setString(Tag.SpecificCharacterSet, VR.CS, "ISO_IR 100");

        // Concept Name Code Sequence
        Attributes titleCode = new Attributes();
        titleCode.setString(Tag.CodeValue, VR.SH, "126000");
        titleCode.setString(Tag.CodingSchemeDesignator, VR.SH, "DCM");
        titleCode.setString(Tag.CodeMeaning, VR.LO, SR_TITLE_IMAGING_MEASUREMENT);
        sr.newSequence(Tag.ConceptNameCodeSequence, 1).add(titleCode);

        // Content Sequence
        Sequence contentSeq = sr.newSequence(Tag.ContentSequence, annotations.size() + 1);
        Attributes container = createContainerItem("126010", "DCM", "Imaging Measurements");
        Sequence containerContent = container.newSequence(Tag.ContentSequence, annotations.size());

        for (int i = 0; i < annotations.size(); i++) {
            AnnotationDto annotation = annotations.get(i);
            Attributes measurementItem = createMeasurementItem(annotation, i + 1);
            containerContent.add(measurementItem);
        }

        contentSeq.add(container);

        // Current Requested Procedure Evidence Sequence
        if (seriesInstanceUid != null) {
            Sequence evidenceSeq = sr.newSequence(Tag.CurrentRequestedProcedureEvidenceSequence, 1);
            Attributes evidence = new Attributes();
            evidence.setString(Tag.StudyInstanceUID, VR.UI, studyInstanceUid);

            Sequence refSeriesSeq = evidence.newSequence(Tag.ReferencedSeriesSequence, 1);
            Attributes refSeries = new Attributes();
            refSeries.setString(Tag.SeriesInstanceUID, VR.UI, seriesInstanceUid);

            Sequence refSopSeq = refSeries.newSequence(Tag.ReferencedSOPSequence, annotations.size());
            for (AnnotationDto annotation : annotations) {
                Attributes refSop = new Attributes();
                refSop.setString(Tag.ReferencedSOPClassUID, VR.UI, UID.SecondaryCaptureImageStorage);
                refSop.setString(Tag.ReferencedSOPInstanceUID, VR.UI, annotation.getSopInstanceUid());
                refSopSeq.add(refSop);
            }

            refSeriesSeq.add(refSeries);
            evidenceSeq.add(evidence);
        }

        return sr;
    }

    private Attributes createContainerItem(String codeValue, String codingScheme, String codeMeaning) {
        Attributes item = new Attributes();
        item.setString(Tag.RelationshipType, VR.CS, "CONTAINS");
        item.setString(Tag.ValueType, VR.CS, "CONTAINER");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, codeValue);
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, codingScheme);
        conceptCode.setString(Tag.CodeMeaning, VR.LO, codeMeaning);
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        item.setString(Tag.ContinuityOfContent, VR.CS, "SEPARATE");
        return item;
    }

    private Attributes createMeasurementItem(AnnotationDto annotation, int index) {
        Attributes item = new Attributes();
        item.setString(Tag.RelationshipType, VR.CS, "CONTAINS");

        String type = annotation.getAnnotationType() != null ?
            annotation.getAnnotationType().toUpperCase() : "TEXT";

        switch (type) {
            case "LENGTH":
                createLengthMeasurement(item, annotation);
                break;
            case "ANGLE":
                createAngleMeasurement(item, annotation);
                break;
            case "ELLIPTICALROI":
            case "ROI":
            case "CIRCLEROI":
            case "RECTANGLEROI":
                createAreaMeasurement(item, annotation);
                break;
            case "ARROWANNOTATE":
            case "ARROW":
                createArrowAnnotation(item, annotation);
                break;
            default:
                createTextAnnotation(item, annotation);
        }

        addImageReference(item, annotation);
        return item;
    }

    private void createLengthMeasurement(Attributes item, AnnotationDto annotation) {
        item.setString(Tag.ValueType, VR.CS, "NUM");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, "G-D7FE");
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, "SRT");
        conceptCode.setString(Tag.CodeMeaning, VR.LO, "Length");
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        double value = extractNumericValue(annotation.getData(), "length", 0.0);
        Sequence mvSeq = item.newSequence(Tag.MeasuredValueSequence, 1);
        Attributes mv = new Attributes();
        mv.setDouble(Tag.NumericValue, VR.DS, value);

        Attributes unitCode = new Attributes();
        unitCode.setString(Tag.CodeValue, VR.SH, "mm");
        unitCode.setString(Tag.CodingSchemeDesignator, VR.SH, "UCUM");
        unitCode.setString(Tag.CodeMeaning, VR.LO, "millimeter");
        mv.newSequence(Tag.MeasurementUnitsCodeSequence, 1).add(unitCode);

        mvSeq.add(mv);
    }

    private void createAngleMeasurement(Attributes item, AnnotationDto annotation) {
        item.setString(Tag.ValueType, VR.CS, "NUM");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, "G-A193");
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, "SRT");
        conceptCode.setString(Tag.CodeMeaning, VR.LO, "Angle");
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        double value = extractNumericValue(annotation.getData(), "angle", 0.0);
        Sequence mvSeq = item.newSequence(Tag.MeasuredValueSequence, 1);
        Attributes mv = new Attributes();
        mv.setDouble(Tag.NumericValue, VR.DS, value);

        Attributes unitCode = new Attributes();
        unitCode.setString(Tag.CodeValue, VR.SH, "deg");
        unitCode.setString(Tag.CodingSchemeDesignator, VR.SH, "UCUM");
        unitCode.setString(Tag.CodeMeaning, VR.LO, "degree");
        mv.newSequence(Tag.MeasurementUnitsCodeSequence, 1).add(unitCode);

        mvSeq.add(mv);
    }

    private void createAreaMeasurement(Attributes item, AnnotationDto annotation) {
        item.setString(Tag.ValueType, VR.CS, "NUM");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, "G-D221");
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, "SRT");
        conceptCode.setString(Tag.CodeMeaning, VR.LO, "Area");
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        double value = extractNumericValue(annotation.getData(), "area", 0.0);
        Sequence mvSeq = item.newSequence(Tag.MeasuredValueSequence, 1);
        Attributes mv = new Attributes();
        mv.setDouble(Tag.NumericValue, VR.DS, value);

        Attributes unitCode = new Attributes();
        unitCode.setString(Tag.CodeValue, VR.SH, "mm2");
        unitCode.setString(Tag.CodingSchemeDesignator, VR.SH, "UCUM");
        unitCode.setString(Tag.CodeMeaning, VR.LO, "square millimeter");
        mv.newSequence(Tag.MeasurementUnitsCodeSequence, 1).add(unitCode);

        mvSeq.add(mv);
    }

    private void createArrowAnnotation(Attributes item, AnnotationDto annotation) {
        item.setString(Tag.ValueType, VR.CS, "SCOORD");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, "111030");
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, "DCM");
        conceptCode.setString(Tag.CodeMeaning, VR.LO, "Image Region");
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        item.setString(Tag.GraphicType, VR.CS, "POINT");
        float[] points = extractGraphicData(annotation.getData());
        if (points != null && points.length >= 2) {
            item.setFloat(Tag.GraphicData, VR.FL, points);
        }
    }

    private void createTextAnnotation(Attributes item, AnnotationDto annotation) {
        item.setString(Tag.ValueType, VR.CS, "TEXT");

        Attributes conceptCode = new Attributes();
        conceptCode.setString(Tag.CodeValue, VR.SH, "113012");
        conceptCode.setString(Tag.CodingSchemeDesignator, VR.SH, "DCM");
        conceptCode.setString(Tag.CodeMeaning, VR.LO, "Annotation");
        item.newSequence(Tag.ConceptNameCodeSequence, 1).add(conceptCode);

        item.setString(Tag.TextValue, VR.UT,
            annotation.getLabel() != null ? annotation.getLabel() :
            (annotation.getData() != null ? annotation.getData() : ""));
    }

    private void addImageReference(Attributes item, AnnotationDto annotation) {
        Sequence refSeq = item.newSequence(Tag.ContentSequence, 1);
        Attributes refItem = new Attributes();
        refItem.setString(Tag.RelationshipType, VR.CS, "INFERRED FROM");
        refItem.setString(Tag.ValueType, VR.CS, "IMAGE");

        Sequence refSopSeq = refItem.newSequence(Tag.ReferencedSOPSequence, 1);
        Attributes refSop = new Attributes();
        refSop.setString(Tag.ReferencedSOPClassUID, VR.UI, UID.SecondaryCaptureImageStorage);
        refSop.setString(Tag.ReferencedSOPInstanceUID, VR.UI, annotation.getSopInstanceUid());
        if (annotation.getFrameNumber() != null && annotation.getFrameNumber() > 0) {
            refSop.setInt(Tag.ReferencedFrameNumber, VR.IS, annotation.getFrameNumber());
        }
        refSopSeq.add(refSop);

        refSeq.add(refItem);
    }

    private double extractNumericValue(String jsonData, String field, double defaultValue) {
        try {
            if (jsonData == null || jsonData.isEmpty()) return defaultValue;
            String search = "\"" + field + "\":";
            int idx = jsonData.indexOf(search);
            if (idx == -1) return defaultValue;
            int start = idx + search.length();
            int end = jsonData.indexOf(",", start);
            if (end == -1) end = jsonData.indexOf("}", start);
            if (end == -1) return defaultValue;
            String valueStr = jsonData.substring(start, end).trim();
            return Double.parseDouble(valueStr);
        } catch (Exception e) {
            return defaultValue;
        }
    }

    private float[] extractGraphicData(String jsonData) {
        try {
            if (jsonData == null) return new float[]{0, 0};
            int handlesIdx = jsonData.indexOf("\"handles\":");
            if (handlesIdx == -1) return new float[]{0, 0};

            java.util.List<Float> points = new java.util.ArrayList<>();
            String[] parts = jsonData.split("\"x\":");
            for (int i = 1; i < parts.length; i++) {
                String part = parts[i];
                int endX = part.indexOf(",");
                if (endX > 0) {
                    float x = Float.parseFloat(part.substring(0, endX).trim());
                    int yIdx = part.indexOf("\"y\":");
                    if (yIdx > 0) {
                        String yPart = part.substring(yIdx + 4);
                        int endY = yPart.indexOf(",");
                        if (endY == -1) endY = yPart.indexOf("}");
                        if (endY > 0) {
                            float y = Float.parseFloat(yPart.substring(0, endY).trim());
                            points.add(x);
                            points.add(y);
                        }
                    }
                }
            }

            float[] result = new float[points.size()];
            for (int i = 0; i < points.size(); i++) {
                result[i] = points.get(i);
            }
            return result;
        } catch (Exception e) {
            log.warn("Failed to parse graphic data: {}", e.getMessage());
            return new float[]{0, 0};
        }
    }

    private byte[] encodeDicom(Attributes dataset) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        try (DicomOutputStream dos = new DicomOutputStream(baos, UID.ExplicitVRLittleEndian)) {
            Attributes fmi = dataset.createFileMetaInformation(UID.ExplicitVRLittleEndian);
            dos.writeDataset(fmi, dataset);
        }
        return baos.toByteArray();
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

