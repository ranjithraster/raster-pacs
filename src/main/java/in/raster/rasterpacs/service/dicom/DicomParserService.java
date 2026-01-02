package in.raster.rasterpacs.service.dicom;

import in.raster.rasterpacs.dto.DicomDataset;
import in.raster.rasterpacs.dto.DicomDataset.DicomAttribute;
import in.raster.rasterpacs.dto.InstanceDto;
import in.raster.rasterpacs.dto.SeriesDto;
import in.raster.rasterpacs.dto.StudyDto;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.VR;
import org.dcm4che3.data.ElementDictionary;
import org.dcm4che3.io.DicomInputStream;
import org.dcm4che3.util.TagUtils;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.file.Path;
import java.util.Iterator;

/**
 * Service for parsing DICOM files and extracting metadata
 */
@Slf4j
@Service
public class DicomParserService {

    private final ElementDictionary dict = ElementDictionary.getStandardElementDictionary();

    /**
     * Parse a DICOM file and return all attributes as DicomDataset
     */
    public DicomDataset parseDicomFile(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            Attributes attrs = dis.readDataset();
            Attributes fmi = dis.readFileMetaInformation();

            // Merge file meta info with dataset
            if (fmi != null) {
                attrs.addAll(fmi);
            }

            return attributesToDataset(attrs);
        }
    }

    /**
     * Parse a DICOM file and return all attributes
     */
    public Attributes readDicomAttributes(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            return dis.readDataset();
        }
    }

    /**
     * Parse a DICOM file and return attributes with file meta information
     */
    public Attributes readDicomAttributesWithFmi(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            Attributes fmi = dis.readFileMetaInformation();
            Attributes attrs = dis.readDataset();
            if (fmi != null) {
                attrs.addAll(fmi);
            }
            return attrs;
        }
    }

    /**
     * Extract StudyDto from DICOM file
     */
    public StudyDto extractStudyInfo(File file) throws IOException {
        Attributes attrs = readDicomAttributes(file);
        return StudyDto.builder()
                .studyInstanceUid(attrs.getString(Tag.StudyInstanceUID))
                .studyDate(attrs.getString(Tag.StudyDate))
                .studyTime(attrs.getString(Tag.StudyTime))
                .studyDescription(attrs.getString(Tag.StudyDescription))
                .accessionNumber(attrs.getString(Tag.AccessionNumber))
                .studyId(attrs.getString(Tag.StudyID))
                .referringPhysicianName(attrs.getString(Tag.ReferringPhysicianName))
                .institutionName(attrs.getString(Tag.InstitutionName))
                .patientId(attrs.getString(Tag.PatientID))
                .patientName(attrs.getString(Tag.PatientName))
                .patientBirthDate(attrs.getString(Tag.PatientBirthDate))
                .patientSex(attrs.getString(Tag.PatientSex))
                .build();
    }

    /**
     * Extract SeriesDto from DICOM file
     */
    public SeriesDto extractSeriesInfo(File file) throws IOException {
        Attributes attrs = readDicomAttributes(file);
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
                .build();
    }

    /**
     * Extract InstanceDto from DICOM file
     */
    public InstanceDto extractInstanceInfo(File file) throws IOException {
        Attributes attrs = readDicomAttributesWithFmi(file);
        return InstanceDto.builder()
                .studyInstanceUid(attrs.getString(Tag.StudyInstanceUID))
                .seriesInstanceUid(attrs.getString(Tag.SeriesInstanceUID))
                .sopInstanceUid(attrs.getString(Tag.SOPInstanceUID))
                .sopClassUid(attrs.getString(Tag.SOPClassUID))
                .instanceNumber(attrs.getInt(Tag.InstanceNumber, 0))
                .contentDate(attrs.getString(Tag.ContentDate))
                .contentTime(attrs.getString(Tag.ContentTime))
                .transferSyntaxUid(attrs.getString(Tag.TransferSyntaxUID))
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
                .filePath(file.getAbsolutePath())
                .build();
    }

    /**
     * Get specific DICOM tag value from file
     */
    public String getTagValue(File file, int tag) throws IOException {
        Attributes attrs = readDicomAttributes(file);
        return attrs.getString(tag);
    }

    /**
     * Get Transfer Syntax UID from file meta information
     */
    public String getTransferSyntax(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            Attributes fmi = dis.readFileMetaInformation();
            return fmi != null ? fmi.getString(Tag.TransferSyntaxUID) : null;
        }
    }

    /**
     * Check if file is a valid DICOM file
     */
    public boolean isValidDicom(File file) {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            dis.readFileMetaInformation();
            return true;
        } catch (Exception e) {
            return false;
        }
    }

    /**
     * Convert Attributes to DicomDataset
     */
    private DicomDataset attributesToDataset(Attributes attrs) {
        DicomDataset dataset = new DicomDataset();

        for (int tag : attrs.tags()) {
            VR vr = attrs.getVR(tag);
            String keyword = dict.keywordOf(tag);
            if (keyword == null || keyword.isEmpty()) {
                keyword = TagUtils.toString(tag);
            }

            Object value = getAttributeValue(attrs, tag, vr);

            DicomAttribute attr = DicomAttribute.builder()
                    .tag(TagUtils.toString(tag))
                    .vr(vr.name())
                    .keyword(keyword)
                    .value(value)
                    .build();

            dataset.addAttribute(keyword, attr);
        }

        return dataset;
    }

    /**
     * Get attribute value based on VR
     */
    private Object getAttributeValue(Attributes attrs, int tag, VR vr) {
        try {
            switch (vr) {
                case AE:
                case AS:
                case CS:
                case DA:
                case DS:
                case DT:
                case IS:
                case LO:
                case LT:
                case PN:
                case SH:
                case ST:
                case TM:
                case UC:
                case UI:
                case UR:
                case UT:
                    String[] strings = attrs.getStrings(tag);
                    if (strings == null) return null;
                    return strings.length == 1 ? strings[0] : strings;

                case FL:
                case FD:
                    double[] doubles = attrs.getDoubles(tag);
                    if (doubles == null) return null;
                    return doubles.length == 1 ? doubles[0] : doubles;

                case SL:
                case SS:
                case UL:
                case US:
                    int[] ints = attrs.getInts(tag);
                    if (ints == null) return null;
                    return ints.length == 1 ? ints[0] : ints;

                case OB:
                case OD:
                case OF:
                case OL:
                case OW:
                case UN:
                    byte[] bytes = attrs.getBytes(tag);
                    return bytes != null ? "[Binary data: " + bytes.length + " bytes]" : null;

                case SQ:
                    return "[Sequence]";

                default:
                    return attrs.getString(tag);
            }
        } catch (Exception e) {
            log.warn("Error reading tag {}: {}", TagUtils.toString(tag), e.getMessage());
            return null;
        }
    }

    /**
     * Extract UIDs from a DICOM file
     */
    public String[] extractUids(File file) throws IOException {
        Attributes attrs = readDicomAttributes(file);
        return new String[] {
                attrs.getString(Tag.StudyInstanceUID),
                attrs.getString(Tag.SeriesInstanceUID),
                attrs.getString(Tag.SOPInstanceUID)
        };
    }
}

