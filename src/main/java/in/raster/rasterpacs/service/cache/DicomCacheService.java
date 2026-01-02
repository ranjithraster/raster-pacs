package in.raster.rasterpacs.service.cache;

import in.raster.rasterpacs.config.CacheProperties;
import in.raster.rasterpacs.dto.InstanceDto;
import in.raster.rasterpacs.model.Instance;
import in.raster.rasterpacs.model.Patient;
import in.raster.rasterpacs.model.Series;
import in.raster.rasterpacs.model.Study;
import in.raster.rasterpacs.repository.InstanceRepository;
import in.raster.rasterpacs.repository.PatientRepository;
import in.raster.rasterpacs.repository.SeriesRepository;
import in.raster.rasterpacs.repository.StudyRepository;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.io.DicomInputStream;
import org.dcm4che3.io.DicomOutputStream;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.annotation.PostConstruct;
import java.io.File;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.List;

/**
 * Service for caching DICOM files locally
 */
@Slf4j
@Service
public class DicomCacheService {

    private final CacheProperties cacheProperties;
    private final PatientRepository patientRepository;
    private final StudyRepository studyRepository;
    private final SeriesRepository seriesRepository;
    private final InstanceRepository instanceRepository;

    private static final DateTimeFormatter DICOM_DATE_FORMAT = DateTimeFormatter.ofPattern("yyyyMMdd");
    private static final DateTimeFormatter DICOM_TIME_FORMAT = DateTimeFormatter.ofPattern("HHmmss");

    public DicomCacheService(
            CacheProperties cacheProperties,
            PatientRepository patientRepository,
            StudyRepository studyRepository,
            SeriesRepository seriesRepository,
            InstanceRepository instanceRepository) {
        this.cacheProperties = cacheProperties;
        this.patientRepository = patientRepository;
        this.studyRepository = studyRepository;
        this.seriesRepository = seriesRepository;
        this.instanceRepository = instanceRepository;
    }

    @PostConstruct
    public void init() {
        // Create cache directory if it doesn't exist
        try {
            Path cachePath = Paths.get(cacheProperties.getPath());
            if (!Files.exists(cachePath)) {
                Files.createDirectories(cachePath);
                log.info("Created DICOM cache directory: {}", cachePath);
            }
        } catch (IOException e) {
            log.error("Failed to create cache directory", e);
        }
    }

    /**
     * Store a DICOM instance to cache
     */
    @Transactional
    public File storeInstance(String studyUID, String seriesUID, String sopInstanceUID,
                              Attributes dataset, String transferSyntax) throws IOException {

        // Create directory structure: cache/studyUID/seriesUID/
        Path studyPath = Paths.get(cacheProperties.getPath(), studyUID);
        Path seriesPath = studyPath.resolve(seriesUID);
        Files.createDirectories(seriesPath);

        // Write DICOM file
        File outputFile = seriesPath.resolve(sopInstanceUID + ".dcm").toFile();

        try (DicomOutputStream dos = new DicomOutputStream(outputFile)) {
            // Create file meta information
            Attributes fmi = dataset.createFileMetaInformation(transferSyntax);
            dos.writeDataset(fmi, dataset);
        }

        // Update database metadata
        updateMetadata(dataset, outputFile);

        return outputFile;
    }

    /**
     * Store a DICOM file to cache (from file)
     */
    @Transactional
    public File storeInstance(File sourceFile) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(sourceFile)) {
            Attributes fmi = dis.readFileMetaInformation();
            Attributes dataset = dis.readDataset();

            String studyUID = dataset.getString(Tag.StudyInstanceUID);
            String seriesUID = dataset.getString(Tag.SeriesInstanceUID);
            String sopInstanceUID = dataset.getString(Tag.SOPInstanceUID);
            String transferSyntax = fmi != null ?
                    fmi.getString(Tag.TransferSyntaxUID) : UID.ExplicitVRLittleEndian;

            return storeInstance(studyUID, seriesUID, sopInstanceUID, dataset, transferSyntax);
        }
    }

    /**
     * Update database metadata from DICOM attributes
     */
    @Transactional
    public void updateMetadata(Attributes dataset, File file) {
        String patientId = dataset.getString(Tag.PatientID, "UNKNOWN");
        String studyUID = dataset.getString(Tag.StudyInstanceUID);
        String seriesUID = dataset.getString(Tag.SeriesInstanceUID);
        String sopInstanceUID = dataset.getString(Tag.SOPInstanceUID);

        // Get or create Patient
        Patient patient = patientRepository.findByPatientId(patientId)
                .orElseGet(() -> {
                    Patient p = new Patient();
                    p.setPatientId(patientId);
                    p.setPatientName(dataset.getString(Tag.PatientName));
                    p.setPatientSex(dataset.getString(Tag.PatientSex));
                    p.setPatientBirthDate(parseDate(dataset.getString(Tag.PatientBirthDate)));
                    return patientRepository.save(p);
                });

        // Get or create Study
        Study study = studyRepository.findByStudyInstanceUid(studyUID)
                .orElseGet(() -> {
                    Study s = new Study();
                    s.setStudyInstanceUid(studyUID);
                    s.setPatient(patient);
                    return s;
                });

        // Update study attributes
        study.setStudyDate(parseDate(dataset.getString(Tag.StudyDate)));
        study.setStudyTime(parseTime(dataset.getString(Tag.StudyTime)));
        study.setStudyDescription(dataset.getString(Tag.StudyDescription));
        study.setAccessionNumber(dataset.getString(Tag.AccessionNumber));
        study.setStudyId(dataset.getString(Tag.StudyID));
        study.setReferringPhysicianName(dataset.getString(Tag.ReferringPhysicianName));
        study.setInstitutionName(dataset.getString(Tag.InstitutionName));
        study.setCached(true);
        study.setCachedAt(LocalDateTime.now());
        study.setLastAccessedAt(LocalDateTime.now());
        final Study savedStudy = studyRepository.save(study);

        // Get or create Series
        Series series = seriesRepository.findBySeriesInstanceUid(seriesUID)
                .orElseGet(() -> {
                    Series ser = new Series();
                    ser.setSeriesInstanceUid(seriesUID);
                    ser.setStudy(savedStudy);
                    return ser;
                });

        // Update series attributes
        series.setModality(dataset.getString(Tag.Modality));
        series.setSeriesNumber(dataset.getInt(Tag.SeriesNumber, 0));
        series.setSeriesDescription(dataset.getString(Tag.SeriesDescription));
        series.setSeriesDate(parseDate(dataset.getString(Tag.SeriesDate)));
        series.setSeriesTime(parseTime(dataset.getString(Tag.SeriesTime)));
        series.setBodyPartExamined(dataset.getString(Tag.BodyPartExamined));
        series.setPatientPosition(dataset.getString(Tag.PatientPosition));
        series.setProtocolName(dataset.getString(Tag.ProtocolName));
        series.setCached(true);
        final Series savedSeries = seriesRepository.save(series);

        // Update modalities in study
        updateModalitiesInStudy(savedStudy);

        // Get or create Instance
        Instance instance = instanceRepository.findBySopInstanceUid(sopInstanceUID)
                .orElseGet(() -> {
                    Instance inst = new Instance();
                    inst.setSopInstanceUid(sopInstanceUID);
                    inst.setSeries(savedSeries);
                    return inst;
                });

        // Update instance attributes
        instance.setSopClassUid(dataset.getString(Tag.SOPClassUID));
        instance.setInstanceNumber(dataset.getInt(Tag.InstanceNumber, 0));
        instance.setContentDate(parseDate(dataset.getString(Tag.ContentDate)));
        instance.setContentTime(parseTime(dataset.getString(Tag.ContentTime)));
        instance.setRows(dataset.getInt(Tag.Rows, 0));
        instance.setColumns(dataset.getInt(Tag.Columns, 0));
        instance.setBitsAllocated(dataset.getInt(Tag.BitsAllocated, 0));
        instance.setBitsStored(dataset.getInt(Tag.BitsStored, 0));
        instance.setHighBit(dataset.getInt(Tag.HighBit, 0));
        instance.setPixelRepresentation(dataset.getInt(Tag.PixelRepresentation, 0));
        instance.setSamplesPerPixel(dataset.getInt(Tag.SamplesPerPixel, 0));
        instance.setPhotometricInterpretation(dataset.getString(Tag.PhotometricInterpretation));
        instance.setNumberOfFrames(dataset.getInt(Tag.NumberOfFrames, 1));
        instance.setWindowCenter(getDoubleValue(dataset, Tag.WindowCenter));
        instance.setWindowWidth(getDoubleValue(dataset, Tag.WindowWidth));
        instance.setRescaleIntercept(getDoubleValue(dataset, Tag.RescaleIntercept));
        instance.setRescaleSlope(getDoubleValue(dataset, Tag.RescaleSlope));
        instance.setSliceThickness(getDoubleValue(dataset, Tag.SliceThickness));
        instance.setSliceLocation(getDoubleValue(dataset, Tag.SliceLocation));
        instance.setImagePositionPatient(getStringArray(dataset, Tag.ImagePositionPatient));
        instance.setImageOrientationPatient(getStringArray(dataset, Tag.ImageOrientationPatient));
        instance.setPixelSpacing(getStringArray(dataset, Tag.PixelSpacing));
        instance.setFilePath(file.getAbsolutePath());
        instance.setFileSize(file.length());
        instance.setCached(true);
        instanceRepository.save(instance);

        // Update series instance count
        savedSeries.setNumberOfInstances((int) instanceRepository.countBySeriesSeriesInstanceUid(seriesUID));
        seriesRepository.save(savedSeries);

        // Update study counts
        updateStudyCounts(savedStudy);
    }

    /**
     * Get the cache path
     */
    public String getCachePath() {
        return cacheProperties.getPath();
    }

    /**
     * Update cache metadata after storing a file via C-GET
     */
    @Transactional
    public void updateCacheMetadata(String studyUID, String seriesUID, String sopInstanceUID, Attributes dataset) {
        try {
            Path filePath = Paths.get(cacheProperties.getPath(), studyUID, seriesUID, sopInstanceUID + ".dcm");
            File file = filePath.toFile();
            if (file.exists()) {
                updateMetadata(dataset, file);
            }
        } catch (Exception e) {
            log.warn("Failed to update cache metadata for instance: {}", sopInstanceUID, e);
        }
    }

    /**
     * Get cached DICOM file
     */
    public File getCachedFile(String studyUID, String seriesUID, String sopInstanceUID) {
        Path filePath = Paths.get(cacheProperties.getPath(), studyUID, seriesUID, sopInstanceUID + ".dcm");
        File file = filePath.toFile();

        if (file.exists()) {
            // Update last accessed time
            studyRepository.findByStudyInstanceUid(studyUID).ifPresent(study -> {
                study.setLastAccessedAt(LocalDateTime.now());
                studyRepository.save(study);
            });
            return file;
        }
        return null;
    }

    /**
     * Check if instance is cached
     */
    public boolean isInstanceCached(String studyUID, String seriesUID, String sopInstanceUID) {
        Path filePath = Paths.get(cacheProperties.getPath(), studyUID, seriesUID, sopInstanceUID + ".dcm");
        return Files.exists(filePath);
    }

    /**
     * Check if study is cached
     */
    public boolean isStudyCached(String studyUID) {
        return studyRepository.findByStudyInstanceUid(studyUID)
                .map(Study::isCached)
                .orElse(false);
    }

    /**
     * Delete cached study
     */
    @Transactional
    public boolean deleteStudy(String studyUID) {
        try {
            Path studyPath = Paths.get(cacheProperties.getPath(), studyUID);
            if (Files.exists(studyPath)) {
                // Delete all files
                Files.walk(studyPath)
                        .sorted((a, b) -> -a.compareTo(b))
                        .forEach(path -> {
                            try {
                                Files.delete(path);
                            } catch (IOException e) {
                                log.warn("Failed to delete: {}", path, e);
                            }
                        });
            }

            // Delete from database
            studyRepository.findByStudyInstanceUid(studyUID).ifPresent(study -> {
                studyRepository.delete(study);
            });

            log.info("Deleted cached study: {}", studyUID);
            return true;
        } catch (Exception e) {
            log.error("Failed to delete study: {}", studyUID, e);
            return false;
        }
    }

    /**
     * Get total cache size in bytes
     */
    public long getCacheSizeBytes() {
        try {
            Path cachePath = Paths.get(cacheProperties.getPath());
            if (!Files.exists(cachePath)) {
                return 0;
            }
            return Files.walk(cachePath)
                    .filter(Files::isRegularFile)
                    .mapToLong(path -> {
                        try {
                            return Files.size(path);
                        } catch (IOException e) {
                            return 0;
                        }
                    })
                    .sum();
        } catch (IOException e) {
            log.error("Failed to calculate cache size", e);
            return 0;
        }
    }

    // Helper methods
    private void updateModalitiesInStudy(Study study) {
        String modalities = seriesRepository.findByStudyStudyInstanceUid(study.getStudyInstanceUid())
                .stream()
                .map(Series::getModality)
                .filter(m -> m != null && !m.isEmpty())
                .distinct()
                .reduce((a, b) -> a + "\\" + b)
                .orElse("");
        study.setModalitiesInStudy(modalities);
        studyRepository.save(study);
    }

    private void updateStudyCounts(Study study) {
        int seriesCount = seriesRepository.findByStudyStudyInstanceUid(study.getStudyInstanceUid()).size();
        int instanceCount = instanceRepository.findBySeriesStudyStudyInstanceUid(study.getStudyInstanceUid()).size();
        study.setNumberOfSeries(seriesCount);
        study.setNumberOfInstances(instanceCount);
        studyRepository.save(study);
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isEmpty()) return null;
        try {
            return LocalDate.parse(dateStr.substring(0, 8), DICOM_DATE_FORMAT);
        } catch (Exception e) {
            return null;
        }
    }

    private LocalTime parseTime(String timeStr) {
        if (timeStr == null || timeStr.isEmpty()) return null;
        try {
            String time = timeStr.length() >= 6 ? timeStr.substring(0, 6) : timeStr;
            return LocalTime.parse(time, DICOM_TIME_FORMAT);
        } catch (Exception e) {
            return null;
        }
    }

    private Double getDoubleValue(Attributes attrs, int tag) {
        try {
            double val = attrs.getDouble(tag, Double.NaN);
            return Double.isNaN(val) ? null : val;
        } catch (Exception e) {
            return null;
        }
    }

    private String getStringArray(Attributes attrs, int tag) {
        String[] values = attrs.getStrings(tag);
        if (values == null || values.length == 0) return null;
        return String.join("\\", values);
    }

    /**
     * Read DICOM attributes from a cached file
     */
    public Attributes readDicomAttributes(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            return dis.readDataset();
        }
    }

    /**
     * Store a Structured Report to cache
     */
    public File storeStructuredReport(String studyUID, String sopInstanceUid, byte[] srBytes) throws IOException {
        // Create SR directory: cache/studyUID/SR/
        Path srPath = Paths.get(cacheProperties.getPath(), studyUID, "SR");
        Files.createDirectories(srPath);

        // Write SR file
        File outputFile = srPath.resolve(sopInstanceUid + ".dcm").toFile();
        Files.write(outputFile.toPath(), srBytes);

        log.info("Stored Structured Report: {}", outputFile.getAbsolutePath());
        return outputFile;
    }

    /**
     * Get all cached instances for a series
     */
    public List<File> getCachedSeriesInstances(String studyUID, String seriesUID) {
        Path seriesPath = Paths.get(cacheProperties.getPath(), studyUID, seriesUID);

        if (!Files.exists(seriesPath)) {
            return List.of();
        }

        try {
            return Files.list(seriesPath)
                    .filter(p -> p.toString().endsWith(".dcm"))
                    .map(Path::toFile)
                    .sorted()
                    .toList();
        } catch (IOException e) {
            log.error("Failed to list series instances", e);
            return List.of();
        }
    }

    /**
     * Get all cached DICOM files for a series (alias for getCachedSeriesInstances)
     * Used by 3D volume rendering to get raw pixel data
     */
    public List<File> getCachedSeriesFiles(String studyUID, String seriesUID) {
        return getCachedSeriesInstances(studyUID, seriesUID);
    }

    /**
     * Get cache statistics
     */
    public CacheStats getCacheStats() {
        CacheStats stats = new CacheStats();
        stats.setTotalSizeBytes(getCacheSizeBytes());
        stats.setTotalStudies((int) studyRepository.count());
        stats.setTotalSeries((int) seriesRepository.count());
        stats.setTotalInstances((int) instanceRepository.count());
        stats.setMaxSizeBytes((long) cacheProperties.getMaxSizeGb() * 1024 * 1024 * 1024);
        stats.setRetentionDays(cacheProperties.getRetentionDays());
        return stats;
    }

    @lombok.Data
    public static class CacheStats {
        private long totalSizeBytes;
        private long maxSizeBytes;
        private int totalStudies;
        private int totalSeries;
        private int totalInstances;
        private int retentionDays;

        public double getUsagePercent() {
            return maxSizeBytes > 0 ? (double) totalSizeBytes / maxSizeBytes * 100 : 0;
        }

        public String getTotalSizeFormatted() {
            if (totalSizeBytes < 1024) return totalSizeBytes + " B";
            if (totalSizeBytes < 1024 * 1024) return String.format("%.1f KB", totalSizeBytes / 1024.0);
            if (totalSizeBytes < 1024 * 1024 * 1024) return String.format("%.1f MB", totalSizeBytes / (1024.0 * 1024));
            return String.format("%.2f GB", totalSizeBytes / (1024.0 * 1024 * 1024));
        }
    }
}

