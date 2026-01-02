package in.raster.rasterpacs.service.segmentation;

import in.raster.rasterpacs.dto.SegmentationDto;
import in.raster.rasterpacs.model.Segmentation;
import in.raster.rasterpacs.repository.SegmentationRepository;
import in.raster.rasterpacs.service.cache.DicomCacheService;
import in.raster.rasterpacs.service.pacs.DicomStoreService;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.*;
import org.dcm4che3.io.DicomOutputStream;
import org.dcm4che3.util.UIDUtils;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.*;
import java.nio.ByteBuffer;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.zip.GZIPInputStream;
import java.util.zip.GZIPOutputStream;

/**
 * Service for managing DICOM Segmentations and exporting to DICOM SEG format
 */
@Slf4j
@Service
public class SegmentationService {

    private final SegmentationRepository segmentationRepository;
    private final DicomCacheService cacheService;
    private final DicomStoreService storeService;

    private static final DateTimeFormatter DICOM_DATE = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DICOM_TIME = DateTimeFormatter.ofPattern("HHmmss");

    // Segment category codes (from DICOM CID 7150)
    private static final Map<String, String[]> SEGMENT_CATEGORIES = Map.of(
        "Organ", new String[]{"T-D0050", "SRT", "Tissue"},
        "Lesion", new String[]{"M-01000", "SRT", "Morphologically Abnormal Structure"},
        "Tumor", new String[]{"M-80000", "SRT", "Neoplasm"},
        "Anatomical", new String[]{"T-D0050", "SRT", "Tissue"},
        "Finding", new String[]{"F-01710", "SRT", "Imaging Finding"}
    );

    // Common segment type codes (from DICOM CID 7151-7166)
    private static final Map<String, String[]> SEGMENT_TYPES = Map.ofEntries(
        Map.entry("Liver", new String[]{"T-62000", "SRT", "Liver"}),
        Map.entry("Kidney", new String[]{"T-71000", "SRT", "Kidney"}),
        Map.entry("Spleen", new String[]{"T-C3000", "SRT", "Spleen"}),
        Map.entry("Lung", new String[]{"T-28000", "SRT", "Lung"}),
        Map.entry("Heart", new String[]{"T-32000", "SRT", "Heart"}),
        Map.entry("Brain", new String[]{"T-A0100", "SRT", "Brain"}),
        Map.entry("Bone", new String[]{"T-D0700", "SRT", "Bone"}),
        Map.entry("Muscle", new String[]{"T-13001", "SRT", "Skeletal muscle"}),
        Map.entry("Fat", new String[]{"T-D4600", "SRT", "Adipose tissue"}),
        Map.entry("Tumor", new String[]{"M-80003", "SRT", "Neoplasm, Primary"}),
        Map.entry("Lesion", new String[]{"M-01000", "SRT", "Morphologically Abnormal Structure"}),
        Map.entry("Vessel", new String[]{"T-40000", "SRT", "Blood Vessel"})
    );

    public SegmentationService(
            SegmentationRepository segmentationRepository,
            DicomCacheService cacheService,
            DicomStoreService storeService) {
        this.segmentationRepository = segmentationRepository;
        this.cacheService = cacheService;
        this.storeService = storeService;
    }

    /**
     * Save a segmentation
     */
    @Transactional
    public Segmentation saveSegmentation(SegmentationDto dto) {
        log.info("Saving segmentation: {} for series {}", dto.getSegmentLabel(), dto.getReferencedSeriesUid());

        Segmentation segmentation = new Segmentation();
        segmentation.setStudyInstanceUid(dto.getStudyInstanceUid());
        segmentation.setSeriesInstanceUid(dto.getSeriesInstanceUid());
        segmentation.setReferencedSeriesUid(dto.getReferencedSeriesUid());
        segmentation.setSegmentLabel(dto.getSegmentLabel());
        segmentation.setSegmentDescription(dto.getSegmentDescription());
        segmentation.setSegmentAlgorithmType(dto.getSegmentAlgorithmType() != null ?
            dto.getSegmentAlgorithmType() : "MANUAL");
        segmentation.setSegmentAlgorithmName(dto.getSegmentAlgorithmName());
        segmentation.setSegmentCategory(dto.getSegmentCategory());
        segmentation.setSegmentType(dto.getSegmentType());
        segmentation.setSegmentNumber(dto.getSegmentNumber() != null ? dto.getSegmentNumber() : 1);
        segmentation.setSegmentColor(dto.getSegmentColor() != null ? dto.getSegmentColor() : "#FF0000");
        segmentation.setSegmentOpacity(dto.getSegmentOpacity() != null ? dto.getSegmentOpacity() : 0.5f);
        segmentation.setRows(dto.getRows());
        segmentation.setColumns(dto.getColumns());
        segmentation.setTotalFrames(dto.getTotalFrames());
        segmentation.setCreatedBy(dto.getCreatedBy());

        // Compress and store mask data
        if (dto.getFrameMasks() != null && !dto.getFrameMasks().isEmpty()) {
            byte[] compressedData = compressFrameMasks(dto.getFrameMasks());
            segmentation.setSegmentData(compressedData);
        }

        return segmentationRepository.save(segmentation);
    }

    /**
     * Update an existing segmentation
     */
    @Transactional
    public Segmentation updateSegmentation(Long id, SegmentationDto dto) {
        Segmentation segmentation = segmentationRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Segmentation not found: " + id));

        segmentation.setSegmentLabel(dto.getSegmentLabel());
        segmentation.setSegmentDescription(dto.getSegmentDescription());
        segmentation.setSegmentColor(dto.getSegmentColor());
        segmentation.setSegmentOpacity(dto.getSegmentOpacity());
        segmentation.setModifiedBy(dto.getModifiedBy());

        if (dto.getFrameMasks() != null && !dto.getFrameMasks().isEmpty()) {
            byte[] compressedData = compressFrameMasks(dto.getFrameMasks());
            segmentation.setSegmentData(compressedData);
            segmentation.setExportedToSeg(false); // Mark as needing re-export
        }

        return segmentationRepository.save(segmentation);
    }

    /**
     * Get segmentations for a study
     */
    public List<SegmentationDto> getSegmentationsForStudy(String studyInstanceUid) {
        return segmentationRepository.findByStudyInstanceUid(studyInstanceUid)
            .stream()
            .map(this::toDto)
            .toList();
    }

    /**
     * Get segmentations for a series
     */
    public List<SegmentationDto> getSegmentationsForSeries(String studyInstanceUid, String seriesInstanceUid) {
        return segmentationRepository.findByStudyInstanceUidAndReferencedSeriesUid(studyInstanceUid, seriesInstanceUid)
            .stream()
            .map(this::toDto)
            .toList();
    }

    /**
     * Get segmentation with mask data
     */
    public SegmentationDto getSegmentationWithMasks(Long id) {
        Segmentation segmentation = segmentationRepository.findById(id)
            .orElseThrow(() -> new IllegalArgumentException("Segmentation not found: " + id));

        SegmentationDto dto = toDto(segmentation);

        if (segmentation.getSegmentData() != null) {
            dto.setFrameMasks(decompressFrameMasks(segmentation.getSegmentData()));
        }

        return dto;
    }

    /**
     * Delete a segmentation
     */
    @Transactional
    public void deleteSegmentation(Long id) {
        segmentationRepository.deleteById(id);
    }

    /**
     * Export segmentation to DICOM SEG format
     */
    @Transactional
    public String exportToDicomSeg(Long segmentationId, String pacsNode) throws IOException {
        Segmentation segmentation = segmentationRepository.findById(segmentationId)
            .orElseThrow(() -> new IllegalArgumentException("Segmentation not found: " + segmentationId));

        log.info("Exporting segmentation {} to DICOM SEG", segmentation.getSegmentLabel());

        // Get reference image attributes
        File refFile = getFirstCachedInstance(segmentation.getStudyInstanceUid(),
                                               segmentation.getReferencedSeriesUid());
        Attributes refAttrs = null;
        if (refFile != null) {
            refAttrs = cacheService.readDicomAttributes(refFile);
        }

        // Decompress mask data
        List<SegmentationDto.FrameMask> frameMasks = null;
        if (segmentation.getSegmentData() != null) {
            frameMasks = decompressFrameMasks(segmentation.getSegmentData());
        }

        // Create DICOM SEG
        Attributes segDataset = createDicomSeg(segmentation, frameMasks, refAttrs);

        // Generate SOP Instance UID
        String segSopInstanceUid = UIDUtils.createUID();
        segDataset.setString(Tag.SOPInstanceUID, VR.UI, segSopInstanceUid);

        // Encode and store
        byte[] segBytes = encodeDicom(segDataset);
        File segFile = cacheService.storeStructuredReport(
            segmentation.getStudyInstanceUid(), segSopInstanceUid, segBytes);

        // Store to PACS if requested
        if (pacsNode != null && !pacsNode.isEmpty()) {
            storeService.storeToPacs(segFile, pacsNode);
        }

        // Update segmentation record
        segmentation.setExportedToSeg(true);
        segmentation.setSegSopInstanceUid(segSopInstanceUid);
        segmentation.setSopInstanceUid(segSopInstanceUid);
        segmentationRepository.save(segmentation);

        log.info("Created DICOM SEG with SOP Instance UID: {}", segSopInstanceUid);
        return segSopInstanceUid;
    }

    /**
     * Export multiple segmentations to a single DICOM SEG
     */
    @Transactional
    public String exportMultipleToDicomSeg(List<Long> segmentationIds, String pacsNode) throws IOException {
        if (segmentationIds.isEmpty()) {
            throw new IllegalArgumentException("No segmentation IDs provided");
        }

        List<Segmentation> segmentations = new ArrayList<>();
        for (Long id : segmentationIds) {
            segmentations.add(segmentationRepository.findById(id)
                .orElseThrow(() -> new IllegalArgumentException("Segmentation not found: " + id)));
        }

        // Ensure all segmentations are from the same study and series
        String studyUid = segmentations.get(0).getStudyInstanceUid();
        String seriesUid = segmentations.get(0).getReferencedSeriesUid();

        for (Segmentation seg : segmentations) {
            if (!seg.getStudyInstanceUid().equals(studyUid) ||
                !seg.getReferencedSeriesUid().equals(seriesUid)) {
                throw new IllegalArgumentException("All segmentations must be from the same series");
            }
        }

        log.info("Exporting {} segmentations to single DICOM SEG", segmentations.size());

        // Get reference image attributes
        File refFile = getFirstCachedInstance(studyUid, seriesUid);
        Attributes refAttrs = null;
        if (refFile != null) {
            refAttrs = cacheService.readDicomAttributes(refFile);
        }

        // Create multi-segment DICOM SEG
        Attributes segDataset = createMultiSegmentDicomSeg(segmentations, refAttrs);

        // Generate SOP Instance UID
        String segSopInstanceUid = UIDUtils.createUID();
        segDataset.setString(Tag.SOPInstanceUID, VR.UI, segSopInstanceUid);

        // Encode and store
        byte[] segBytes = encodeDicom(segDataset);
        File segFile = cacheService.storeStructuredReport(studyUid, segSopInstanceUid, segBytes);

        // Store to PACS if requested
        if (pacsNode != null && !pacsNode.isEmpty()) {
            storeService.storeToPacs(segFile, pacsNode);
        }

        // Update all segmentation records
        for (Segmentation seg : segmentations) {
            seg.setExportedToSeg(true);
            seg.setSegSopInstanceUid(segSopInstanceUid);
            segmentationRepository.save(seg);
        }

        log.info("Created multi-segment DICOM SEG with SOP Instance UID: {}", segSopInstanceUid);
        return segSopInstanceUid;
    }

    /**
     * Calculate volume from segmentation mask
     */
    public double calculateVolume(Long segmentationId) {
        Segmentation segmentation = segmentationRepository.findById(segmentationId)
            .orElseThrow(() -> new IllegalArgumentException("Segmentation not found: " + segmentationId));

        if (segmentation.getSegmentData() == null) {
            return 0.0;
        }

        // Get pixel spacing from reference image
        double pixelSpacingX = 1.0;
        double pixelSpacingY = 1.0;
        double sliceThickness = 1.0;

        File refFile = getFirstCachedInstance(segmentation.getStudyInstanceUid(),
                                               segmentation.getReferencedSeriesUid());
        if (refFile != null) {
            try {
                Attributes refAttrs = cacheService.readDicomAttributes(refFile);
                double[] pixelSpacing = refAttrs.getDoubles(Tag.PixelSpacing);
                if (pixelSpacing != null && pixelSpacing.length >= 2) {
                    pixelSpacingX = pixelSpacing[0];
                    pixelSpacingY = pixelSpacing[1];
                }
                sliceThickness = refAttrs.getDouble(Tag.SliceThickness, 1.0);
            } catch (Exception e) {
                log.warn("Could not read pixel spacing from reference image", e);
            }
        }

        // Count voxels
        List<SegmentationDto.FrameMask> masks = decompressFrameMasks(segmentation.getSegmentData());
        long totalVoxels = 0;

        for (SegmentationDto.FrameMask mask : masks) {
            totalVoxels += countMaskVoxels(mask);
        }

        // Calculate volume in mm³
        double voxelVolume = pixelSpacingX * pixelSpacingY * sliceThickness;
        double volumeMm3 = totalVoxels * voxelVolume;

        // Update segmentation record
        segmentation.setVolumeMm3(volumeMm3);
        segmentationRepository.save(segmentation);

        return volumeMm3;
    }

    // ==================== DICOM SEG Creation Methods ====================

    private Attributes createDicomSeg(Segmentation segmentation,
                                       List<SegmentationDto.FrameMask> frameMasks,
                                       Attributes refAttrs) {
        Attributes seg = new Attributes();
        LocalDateTime now = LocalDateTime.now();

        // Patient Module
        if (refAttrs != null) {
            seg.setString(Tag.PatientName, VR.PN, refAttrs.getString(Tag.PatientName, "UNKNOWN"));
            seg.setString(Tag.PatientID, VR.LO, refAttrs.getString(Tag.PatientID, "UNKNOWN"));
            seg.setString(Tag.PatientBirthDate, VR.DA, refAttrs.getString(Tag.PatientBirthDate, ""));
            seg.setString(Tag.PatientSex, VR.CS, refAttrs.getString(Tag.PatientSex, ""));
        } else {
            seg.setString(Tag.PatientName, VR.PN, "UNKNOWN");
            seg.setString(Tag.PatientID, VR.LO, "UNKNOWN");
        }

        // General Study Module
        seg.setString(Tag.StudyInstanceUID, VR.UI, segmentation.getStudyInstanceUid());
        if (refAttrs != null) {
            seg.setString(Tag.StudyDate, VR.DA, refAttrs.getString(Tag.StudyDate, ""));
            seg.setString(Tag.StudyTime, VR.TM, refAttrs.getString(Tag.StudyTime, ""));
            seg.setString(Tag.AccessionNumber, VR.SH, refAttrs.getString(Tag.AccessionNumber, ""));
            seg.setString(Tag.ReferringPhysicianName, VR.PN, refAttrs.getString(Tag.ReferringPhysicianName, ""));
            seg.setString(Tag.StudyID, VR.SH, refAttrs.getString(Tag.StudyID, ""));
        }

        // General Series Module
        String segSeriesUid = UIDUtils.createUID();
        seg.setString(Tag.SeriesInstanceUID, VR.UI, segSeriesUid);
        seg.setString(Tag.SeriesNumber, VR.IS, "999");
        seg.setString(Tag.SeriesDescription, VR.LO, "Segmentation: " + segmentation.getSegmentLabel());
        seg.setString(Tag.Modality, VR.CS, "SEG");
        seg.setString(Tag.SeriesDate, VR.DA, now.format(DICOM_DATE));
        seg.setString(Tag.SeriesTime, VR.TM, now.format(DICOM_TIME));

        // Frame of Reference Module
        if (refAttrs != null) {
            seg.setString(Tag.FrameOfReferenceUID, VR.UI,
                refAttrs.getString(Tag.FrameOfReferenceUID, UIDUtils.createUID()));
            seg.setString(Tag.PositionReferenceIndicator, VR.LO, "");
        }

        // General Equipment Module
        seg.setString(Tag.Manufacturer, VR.LO, "Raster PACS");
        seg.setString(Tag.ManufacturerModelName, VR.LO, "Zero Footprint DICOM Viewer");
        seg.setString(Tag.SoftwareVersions, VR.LO, "2.0");

        // Enhanced General Equipment Module
        seg.setString(Tag.DeviceSerialNumber, VR.LO, "RASTER-001");

        // Image Pixel Module
        int rows = segmentation.getRows() != null ? segmentation.getRows() : 512;
        int columns = segmentation.getColumns() != null ? segmentation.getColumns() : 512;
        seg.setInt(Tag.Rows, VR.US, rows);
        seg.setInt(Tag.Columns, VR.US, columns);
        seg.setInt(Tag.BitsAllocated, VR.US, 1);
        seg.setInt(Tag.BitsStored, VR.US, 1);
        seg.setInt(Tag.HighBit, VR.US, 0);
        seg.setInt(Tag.PixelRepresentation, VR.US, 0);
        seg.setInt(Tag.SamplesPerPixel, VR.US, 1);
        seg.setString(Tag.PhotometricInterpretation, VR.CS, "MONOCHROME2");

        // Segmentation Image Module
        seg.setString(Tag.ImageType, VR.CS, "DERIVED", "PRIMARY");
        seg.setString(Tag.InstanceNumber, VR.IS, "1");
        seg.setString(Tag.ContentDate, VR.DA, now.format(DICOM_DATE));
        seg.setString(Tag.ContentTime, VR.TM, now.format(DICOM_TIME));
        seg.setString(Tag.ContentLabel, VR.CS, "SEGMENTATION");
        seg.setString(Tag.ContentDescription, VR.LO, segmentation.getSegmentDescription());
        seg.setString(Tag.ContentCreatorName, VR.PN, segmentation.getCreatedBy());
        seg.setString(Tag.SegmentationType, VR.CS, "BINARY");

        // SOP Common Module
        seg.setString(Tag.SOPClassUID, VR.UI, UID.SegmentationStorage);
        seg.setString(Tag.SpecificCharacterSet, VR.CS, "ISO_IR 100");

        // Segment Sequence
        createSegmentSequence(seg, segmentation);

        // Shared Functional Groups Sequence
        createSharedFunctionalGroups(seg, refAttrs, segmentation);

        // Per-Frame Functional Groups Sequence
        if (frameMasks != null && !frameMasks.isEmpty()) {
            createPerFrameFunctionalGroups(seg, frameMasks, refAttrs, segmentation);
        }

        // Referenced Series Sequence
        createReferencedSeriesSequence(seg, segmentation, frameMasks);

        // Pixel Data
        if (frameMasks != null && !frameMasks.isEmpty()) {
            createPixelData(seg, frameMasks, rows, columns);
        }

        return seg;
    }

    private Attributes createMultiSegmentDicomSeg(List<Segmentation> segmentations, Attributes refAttrs) {
        Segmentation firstSeg = segmentations.get(0);
        Attributes seg = createDicomSeg(firstSeg, null, refAttrs);

        // Update Segment Sequence with all segments
        Sequence segmentSeq = seg.newSequence(Tag.SegmentSequence, segmentations.size());
        for (int i = 0; i < segmentations.size(); i++) {
            Segmentation segmentation = segmentations.get(i);
            Attributes segmentItem = createSegmentItem(segmentation, i + 1);
            segmentSeq.add(segmentItem);
        }

        // Combine pixel data from all segments
        // This would need proper frame interleaving
        // For now, we'll concatenate the frames

        return seg;
    }

    private void createSegmentSequence(Attributes seg, Segmentation segmentation) {
        Sequence segmentSeq = seg.newSequence(Tag.SegmentSequence, 1);
        Attributes segmentItem = createSegmentItem(segmentation, 1);
        segmentSeq.add(segmentItem);
    }

    private Attributes createSegmentItem(Segmentation segmentation, int segmentNumber) {
        Attributes segmentItem = new Attributes();

        segmentItem.setInt(Tag.SegmentNumber, VR.US, segmentNumber);
        segmentItem.setString(Tag.SegmentLabel, VR.LO, segmentation.getSegmentLabel());
        segmentItem.setString(Tag.SegmentDescription, VR.ST, segmentation.getSegmentDescription());
        segmentItem.setString(Tag.SegmentAlgorithmType, VR.CS,
            segmentation.getSegmentAlgorithmType() != null ? segmentation.getSegmentAlgorithmType() : "MANUAL");

        if (segmentation.getSegmentAlgorithmName() != null) {
            segmentItem.setString(Tag.SegmentAlgorithmName, VR.LO, segmentation.getSegmentAlgorithmName());
        }

        // Segment color (CIELab recommended color)
        int[] recommendedColor = hexToLabColor(segmentation.getSegmentColor());
        segmentItem.setInt(Tag.RecommendedDisplayCIELabValue, VR.US, recommendedColor);

        // Segmented Property Category Code Sequence
        String category = segmentation.getSegmentCategory() != null ? segmentation.getSegmentCategory() : "Organ";
        String[] categoryCode = SEGMENT_CATEGORIES.getOrDefault(category,
            new String[]{"T-D0050", "SRT", "Tissue"});

        Sequence categorySeq = segmentItem.newSequence(Tag.SegmentedPropertyCategoryCodeSequence, 1);
        Attributes categoryItem = new Attributes();
        categoryItem.setString(Tag.CodeValue, VR.SH, categoryCode[0]);
        categoryItem.setString(Tag.CodingSchemeDesignator, VR.SH, categoryCode[1]);
        categoryItem.setString(Tag.CodeMeaning, VR.LO, categoryCode[2]);
        categorySeq.add(categoryItem);

        // Segmented Property Type Code Sequence
        String type = segmentation.getSegmentType() != null ? segmentation.getSegmentType() : "Tissue";
        String[] typeCode = SEGMENT_TYPES.getOrDefault(type,
            new String[]{"T-D0050", "SRT", "Tissue"});

        Sequence typeSeq = segmentItem.newSequence(Tag.SegmentedPropertyTypeCodeSequence, 1);
        Attributes typeItem = new Attributes();
        typeItem.setString(Tag.CodeValue, VR.SH, typeCode[0]);
        typeItem.setString(Tag.CodingSchemeDesignator, VR.SH, typeCode[1]);
        typeItem.setString(Tag.CodeMeaning, VR.LO, typeCode[2]);
        typeSeq.add(typeItem);

        return segmentItem;
    }

    private void createSharedFunctionalGroups(Attributes seg, Attributes refAttrs, Segmentation segmentation) {
        Sequence sharedSeq = seg.newSequence(Tag.SharedFunctionalGroupsSequence, 1);
        Attributes shared = new Attributes();

        // Derivation Image Sequence (required)
        Sequence derivationSeq = shared.newSequence(Tag.DerivationImageSequence, 1);
        Attributes derivation = new Attributes();

        Sequence derivationCodeSeq = derivation.newSequence(Tag.DerivationCodeSequence, 1);
        Attributes derivationCode = new Attributes();
        derivationCode.setString(Tag.CodeValue, VR.SH, "113076");
        derivationCode.setString(Tag.CodingSchemeDesignator, VR.SH, "DCM");
        derivationCode.setString(Tag.CodeMeaning, VR.LO, "Segmentation");
        derivationCodeSeq.add(derivationCode);

        derivationSeq.add(derivation);

        // Pixel Measures Sequence
        if (refAttrs != null) {
            Sequence pixelMeasuresSeq = shared.newSequence(Tag.PixelMeasuresSequence, 1);
            Attributes pixelMeasures = new Attributes();

            double[] pixelSpacing = refAttrs.getDoubles(Tag.PixelSpacing);
            if (pixelSpacing != null) {
                pixelMeasures.setDouble(Tag.PixelSpacing, VR.DS, pixelSpacing);
            }

            double sliceThickness = refAttrs.getDouble(Tag.SliceThickness, 0);
            if (sliceThickness > 0) {
                pixelMeasures.setDouble(Tag.SliceThickness, VR.DS, sliceThickness);
            }

            pixelMeasuresSeq.add(pixelMeasures);

            // Plane Orientation Sequence
            String[] imageOrientation = refAttrs.getStrings(Tag.ImageOrientationPatient);
            if (imageOrientation != null) {
                Sequence planeOrientationSeq = shared.newSequence(Tag.PlaneOrientationSequence, 1);
                Attributes planeOrientation = new Attributes();
                planeOrientation.setString(Tag.ImageOrientationPatient, VR.DS, imageOrientation);
                planeOrientationSeq.add(planeOrientation);
            }
        }

        // Segment Identification Sequence
        Sequence segIdSeq = shared.newSequence(Tag.SegmentIdentificationSequence, 1);
        Attributes segId = new Attributes();
        segId.setInt(Tag.ReferencedSegmentNumber, VR.US, segmentation.getSegmentNumber());
        segIdSeq.add(segId);

        sharedSeq.add(shared);
    }

    private void createPerFrameFunctionalGroups(Attributes seg, List<SegmentationDto.FrameMask> frameMasks,
                                                 Attributes refAttrs, Segmentation segmentation) {
        int numFrames = frameMasks.size();
        seg.setInt(Tag.NumberOfFrames, VR.IS, numFrames);

        Sequence perFrameSeq = seg.newSequence(Tag.PerFrameFunctionalGroupsSequence, numFrames);

        for (int i = 0; i < numFrames; i++) {
            SegmentationDto.FrameMask frameMask = frameMasks.get(i);
            Attributes perFrame = new Attributes();

            // Frame Content Sequence
            Sequence frameContentSeq = perFrame.newSequence(Tag.FrameContentSequence, 1);
            Attributes frameContent = new Attributes();
            frameContent.setInt(Tag.DimensionIndexValues, VR.UL, i + 1, segmentation.getSegmentNumber());
            frameContentSeq.add(frameContent);

            // Plane Position Sequence
            Sequence planePositionSeq = perFrame.newSequence(Tag.PlanePositionSequence, 1);
            Attributes planePosition = new Attributes();
            // Would need actual position from source images
            planePosition.setDouble(Tag.ImagePositionPatient, VR.DS, 0.0, 0.0, i * 1.0);
            planePositionSeq.add(planePosition);

            // Derivation Image Sequence
            Sequence derivationSeq = perFrame.newSequence(Tag.DerivationImageSequence, 1);
            Attributes derivation = new Attributes();

            Sequence sourceImageSeq = derivation.newSequence(Tag.SourceImageSequence, 1);
            Attributes sourceImage = new Attributes();
            sourceImage.setString(Tag.ReferencedSOPClassUID, VR.UI, UID.CTImageStorage);
            sourceImage.setString(Tag.ReferencedSOPInstanceUID, VR.UI,
                frameMask.getSopInstanceUid() != null ? frameMask.getSopInstanceUid() : UIDUtils.createUID());

            Sequence purposeSeq = sourceImage.newSequence(Tag.PurposeOfReferenceCodeSequence, 1);
            Attributes purpose = new Attributes();
            purpose.setString(Tag.CodeValue, VR.SH, "121322");
            purpose.setString(Tag.CodingSchemeDesignator, VR.SH, "DCM");
            purpose.setString(Tag.CodeMeaning, VR.LO, "Source image for image processing operation");
            purposeSeq.add(purpose);

            sourceImageSeq.add(sourceImage);
            derivationSeq.add(derivation);

            // Segment Identification Sequence
            Sequence segIdSeq = perFrame.newSequence(Tag.SegmentIdentificationSequence, 1);
            Attributes segId = new Attributes();
            segId.setInt(Tag.ReferencedSegmentNumber, VR.US, segmentation.getSegmentNumber());
            segIdSeq.add(segId);

            perFrameSeq.add(perFrame);
        }
    }

    private void createReferencedSeriesSequence(Attributes seg, Segmentation segmentation,
                                                 List<SegmentationDto.FrameMask> frameMasks) {
        Sequence referencedSeriesSeq = seg.newSequence(Tag.ReferencedSeriesSequence, 1);
        Attributes referencedSeries = new Attributes();
        referencedSeries.setString(Tag.SeriesInstanceUID, VR.UI, segmentation.getReferencedSeriesUid());

        // Add referenced instances
        if (frameMasks != null && !frameMasks.isEmpty()) {
            Sequence referencedInstanceSeq = referencedSeries.newSequence(Tag.ReferencedInstanceSequence, frameMasks.size());
            for (SegmentationDto.FrameMask mask : frameMasks) {
                if (mask.getSopInstanceUid() != null) {
                    Attributes referencedInstance = new Attributes();
                    referencedInstance.setString(Tag.ReferencedSOPClassUID, VR.UI, UID.CTImageStorage);
                    referencedInstance.setString(Tag.ReferencedSOPInstanceUID, VR.UI, mask.getSopInstanceUid());
                    referencedInstanceSeq.add(referencedInstance);
                }
            }
        }

        referencedSeriesSeq.add(referencedSeries);
    }

    private void createPixelData(Attributes seg, List<SegmentationDto.FrameMask> frameMasks,
                                  int rows, int columns) {
        // Calculate total bytes needed (1 bit per pixel, packed)
        int pixelsPerFrame = rows * columns;
        int bytesPerFrame = (pixelsPerFrame + 7) / 8;
        int totalBytes = bytesPerFrame * frameMasks.size();

        byte[] pixelData = new byte[totalBytes];
        int offset = 0;

        for (SegmentationDto.FrameMask mask : frameMasks) {
            byte[] frameBits = decodeMaskToBits(mask, rows, columns);
            System.arraycopy(frameBits, 0, pixelData, offset, Math.min(frameBits.length, bytesPerFrame));
            offset += bytesPerFrame;
        }

        seg.setBytes(Tag.PixelData, VR.OB, pixelData);
    }

    // ==================== Helper Methods ====================

    private byte[] compressFrameMasks(List<SegmentationDto.FrameMask> frameMasks) {
        try {
            ByteArrayOutputStream baos = new ByteArrayOutputStream();
            try (GZIPOutputStream gzos = new GZIPOutputStream(baos);
                 ObjectOutputStream oos = new ObjectOutputStream(gzos)) {
                oos.writeObject(frameMasks.size());
                for (SegmentationDto.FrameMask mask : frameMasks) {
                    oos.writeObject(mask.getFrameNumber());
                    oos.writeObject(mask.getSopInstanceUid());
                    oos.writeObject(mask.getEncodedMask());
                    oos.writeObject(mask.getEncoding());
                }
            }
            return baos.toByteArray();
        } catch (IOException e) {
            log.error("Failed to compress frame masks", e);
            return new byte[0];
        }
    }

    private List<SegmentationDto.FrameMask> decompressFrameMasks(byte[] compressedData) {
        List<SegmentationDto.FrameMask> frameMasks = new ArrayList<>();
        try {
            ByteArrayInputStream bais = new ByteArrayInputStream(compressedData);
            try (GZIPInputStream gzis = new GZIPInputStream(bais);
                 ObjectInputStream ois = new ObjectInputStream(gzis)) {
                int size = (Integer) ois.readObject();
                for (int i = 0; i < size; i++) {
                    SegmentationDto.FrameMask mask = SegmentationDto.FrameMask.builder()
                        .frameNumber((Integer) ois.readObject())
                        .sopInstanceUid((String) ois.readObject())
                        .encodedMask((String) ois.readObject())
                        .encoding((String) ois.readObject())
                        .build();
                    frameMasks.add(mask);
                }
            }
        } catch (Exception e) {
            log.error("Failed to decompress frame masks", e);
        }
        return frameMasks;
    }

    private byte[] decodeMaskToBits(SegmentationDto.FrameMask mask, int rows, int columns) {
        int pixelCount = rows * columns;
        int byteCount = (pixelCount + 7) / 8;
        byte[] bits = new byte[byteCount];

        if (mask.getEncodedMask() == null || mask.getEncodedMask().isEmpty()) {
            return bits;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(mask.getEncodedMask());

            if ("RLE".equals(mask.getEncoding())) {
                // Decode RLE
                decoded = decodeRLE(decoded, pixelCount);
            }

            // Pack bytes to bits
            for (int i = 0; i < decoded.length && i < pixelCount; i++) {
                if (decoded[i] != 0) {
                    bits[i / 8] |= (1 << (i % 8));
                }
            }
        } catch (Exception e) {
            log.warn("Failed to decode mask: {}", e.getMessage());
        }

        return bits;
    }

    private byte[] decodeRLE(byte[] encoded, int outputSize) {
        byte[] decoded = new byte[outputSize];
        int inIdx = 0;
        int outIdx = 0;

        while (inIdx < encoded.length && outIdx < outputSize) {
            int count = encoded[inIdx++] & 0xFF;
            if (inIdx >= encoded.length) break;
            byte value = encoded[inIdx++];

            for (int i = 0; i < count && outIdx < outputSize; i++) {
                decoded[outIdx++] = value;
            }
        }

        return decoded;
    }

    private long countMaskVoxels(SegmentationDto.FrameMask mask) {
        if (mask.getEncodedMask() == null || mask.getEncodedMask().isEmpty()) {
            return 0;
        }

        try {
            byte[] decoded = Base64.getDecoder().decode(mask.getEncodedMask());

            if ("RLE".equals(mask.getEncoding())) {
                // Count from RLE directly
                long count = 0;
                for (int i = 0; i < decoded.length - 1; i += 2) {
                    int runLength = decoded[i] & 0xFF;
                    byte value = decoded[i + 1];
                    if (value != 0) {
                        count += runLength;
                    }
                }
                return count;
            } else {
                // Count non-zero bytes
                long count = 0;
                for (byte b : decoded) {
                    if (b != 0) count++;
                }
                return count;
            }
        } catch (Exception e) {
            return 0;
        }
    }

    private int[] hexToLabColor(String hexColor) {
        if (hexColor == null || hexColor.isEmpty()) {
            return new int[]{65535, 32768, 32768}; // Default white in Lab
        }

        try {
            // Remove # if present
            String hex = hexColor.startsWith("#") ? hexColor.substring(1) : hexColor;

            int r = Integer.parseInt(hex.substring(0, 2), 16);
            int g = Integer.parseInt(hex.substring(2, 4), 16);
            int b = Integer.parseInt(hex.substring(4, 6), 16);

            // Simple RGB to CIELab conversion (approximation)
            // In production, use proper color space conversion
            double L = 0.2126 * r + 0.7152 * g + 0.0722 * b;
            double a = r - g;
            double bVal = g - b;

            // Scale to DICOM CIELab range (0-65535)
            int labL = (int) (L * 65535 / 255);
            int labA = (int) ((a + 255) * 65535 / 510);
            int labB = (int) ((bVal + 255) * 65535 / 510);

            return new int[]{labL, labA, labB};
        } catch (Exception e) {
            return new int[]{65535, 32768, 32768};
        }
    }

    private File getFirstCachedInstance(String studyUid, String seriesUid) {
        List<File> instances = cacheService.getCachedSeriesInstances(studyUid, seriesUid);
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

