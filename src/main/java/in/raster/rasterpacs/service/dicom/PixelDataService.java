package in.raster.rasterpacs.service.dicom;

import in.raster.rasterpacs.dto.VolumeMetadata;
import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.io.DicomInputStream;
import org.springframework.stereotype.Service;

import java.io.File;
import java.io.IOException;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.*;

/**
 * Service for extracting raw pixel data from DICOM files for 3D volume rendering.
 * Provides HU-accurate pixel data with rescale parameters.
 */
@Slf4j
@Service
public class PixelDataService {

    /**
     * Result class containing metadata and raw pixel bytes
     */
    public static class VolumeData {
        private final VolumeMetadata metadata;
        private final byte[] pixelData;

        public VolumeData(VolumeMetadata metadata, byte[] pixelData) {
            this.metadata = metadata;
            this.pixelData = pixelData;
        }

        public VolumeMetadata getMetadata() {
            return metadata;
        }

        public byte[] getPixelData() {
            return pixelData;
        }
    }

    /**
     * Internal class for slice data with position for sorting
     */
    private static class SliceData {
        final double position;
        final short[] pixels;
        final int instanceNumber;

        SliceData(double position, short[] pixels, int instanceNumber) {
            this.position = position;
            this.pixels = pixels;
            this.instanceNumber = instanceNumber;
        }
    }

    /**
     * Extract volume data from a series of DICOM files
     *
     * @param dicomFiles List of DICOM files in the series
     * @param subsample  Subsample factor (1 = all slices, 2 = every 2nd, etc.)
     * @return VolumeData containing metadata and raw pixel bytes
     */
    public VolumeData extractVolumeData(List<File> dicomFiles, int subsample) throws IOException {
        if (dicomFiles == null || dicomFiles.isEmpty()) {
            throw new IllegalArgumentException("No DICOM files provided");
        }

        log.info("Extracting volume data from {} files with subsample factor {}", dicomFiles.size(), subsample);

        // Read first file to get metadata
        Attributes firstAttrs = readAttributes(dicomFiles.get(0));

        int rows = firstAttrs.getInt(Tag.Rows, 0);
        int columns = firstAttrs.getInt(Tag.Columns, 0);
        int bitsAllocated = firstAttrs.getInt(Tag.BitsAllocated, 16);
        int bitsStored = firstAttrs.getInt(Tag.BitsStored, 16);
        int highBit = firstAttrs.getInt(Tag.HighBit, bitsStored - 1);
        int pixelRepresentation = firstAttrs.getInt(Tag.PixelRepresentation, 0);
        String photometric = firstAttrs.getString(Tag.PhotometricInterpretation, "MONOCHROME2");

        double rescaleSlope = firstAttrs.getDouble(Tag.RescaleSlope, 1.0);
        double rescaleIntercept = firstAttrs.getDouble(Tag.RescaleIntercept, 0.0);
        String rescaleType = firstAttrs.getString(Tag.RescaleType, "HU");

        double sliceThickness = firstAttrs.getDouble(Tag.SliceThickness, 1.0);
        double spacingBetweenSlices = firstAttrs.getDouble(Tag.SpacingBetweenSlices, sliceThickness);

        double[] pixelSpacingArr = firstAttrs.getDoubles(Tag.PixelSpacing);
        List<Double> pixelSpacing = pixelSpacingArr != null ?
            Arrays.stream(pixelSpacingArr).boxed().toList() :
            Arrays.asList(1.0, 1.0);

        double[] ippArr = firstAttrs.getDoubles(Tag.ImagePositionPatient);
        List<Double> imagePositionPatient = ippArr != null ?
            Arrays.stream(ippArr).boxed().toList() :
            Arrays.asList(0.0, 0.0, 0.0);

        double[] iopArr = firstAttrs.getDoubles(Tag.ImageOrientationPatient);
        List<Double> imageOrientationPatient = iopArr != null ?
            Arrays.stream(iopArr).boxed().toList() :
            Arrays.asList(1.0, 0.0, 0.0, 0.0, 1.0, 0.0);

        // Read all slices and sort by position
        List<SliceData> slices = new ArrayList<>();

        for (File file : dicomFiles) {
            try {
                SliceData sliceData = extractSliceData(file, rows, columns);
                if (sliceData != null) {
                    slices.add(sliceData);
                }
            } catch (Exception e) {
                log.warn("Failed to extract slice from {}: {}", file.getName(), e.getMessage());
            }
        }

        // Sort slices by position (or instance number if positions are equal)
        slices.sort(Comparator.comparingDouble((SliceData a) -> a.position)
            .thenComparingInt(a -> a.instanceNumber));

        // Apply subsampling
        List<SliceData> sampledSlices = new ArrayList<>();
        for (int i = 0; i < slices.size(); i += subsample) {
            sampledSlices.add(slices.get(i));
        }

        int originalSliceCount = slices.size();
        int sliceCount = sampledSlices.size();

        log.info("Volume: {}x{}x{} (subsampled from {} slices)", columns, rows, sliceCount, originalSliceCount);

        // Collect slice positions
        List<Double> slicePositions = sampledSlices.stream()
            .map(s -> s.position)
            .toList();

        // Combine pixel data into a single byte array (Int16 format, little-endian)
        int pixelsPerSlice = rows * columns;
        int bytesPerSlice = pixelsPerSlice * 2; // 16-bit = 2 bytes per pixel
        byte[] volumeData = new byte[sliceCount * bytesPerSlice];

        ByteBuffer buffer = ByteBuffer.wrap(volumeData).order(ByteOrder.LITTLE_ENDIAN);

        for (SliceData slice : sampledSlices) {
            for (short pixel : slice.pixels) {
                buffer.putShort(pixel);
            }
        }

        // Determine data format
        String dataFormat = pixelRepresentation == 0 ? "UINT16" : "INT16";

        // Build metadata
        VolumeMetadata metadata = VolumeMetadata.builder()
            .studyInstanceUid(firstAttrs.getString(Tag.StudyInstanceUID))
            .seriesInstanceUid(firstAttrs.getString(Tag.SeriesInstanceUID))
            .rows(rows)
            .columns(columns)
            .sliceCount(sliceCount)
            .bitsAllocated(bitsAllocated)
            .bitsStored(bitsStored)
            .highBit(highBit)
            .pixelRepresentation(pixelRepresentation)
            .photometricInterpretation(photometric)
            .rescaleSlope(rescaleSlope)
            .rescaleIntercept(rescaleIntercept)
            .rescaleType(rescaleType)
            .sliceThickness(sliceThickness)
            .spacingBetweenSlices(spacingBetweenSlices * subsample)
            .pixelSpacing(pixelSpacing)
            .imagePositionPatient(imagePositionPatient)
            .imageOrientationPatient(imageOrientationPatient)
            .slicePositions(slicePositions)
            .dataFormat(dataFormat)
            .totalBytes((long) volumeData.length)
            .subsampleFactor(subsample)
            .originalSliceCount(originalSliceCount)
            .build();

        return new VolumeData(metadata, volumeData);
    }

    /**
     * Extract pixel data from a single DICOM slice
     */
    private SliceData extractSliceData(File file, int expectedRows, int expectedCols) throws IOException {
        Attributes attrs = readAttributes(file);

        int rows = attrs.getInt(Tag.Rows, 0);
        int columns = attrs.getInt(Tag.Columns, 0);

        if (rows != expectedRows || columns != expectedCols) {
            log.warn("Slice dimension mismatch: expected {}x{}, got {}x{}",
                expectedCols, expectedRows, columns, rows);
            return null;
        }

        // Get slice position (use SliceLocation or compute from ImagePositionPatient)
        double position = attrs.getDouble(Tag.SliceLocation, Double.NaN);
        if (Double.isNaN(position)) {
            double[] ipp = attrs.getDoubles(Tag.ImagePositionPatient);
            double[] iop = attrs.getDoubles(Tag.ImageOrientationPatient);
            if (ipp != null && iop != null) {
                // Compute slice position along the normal vector
                // Normal = row_direction x col_direction
                double nx = iop[1] * iop[5] - iop[2] * iop[4];
                double ny = iop[2] * iop[3] - iop[0] * iop[5];
                double nz = iop[0] * iop[4] - iop[1] * iop[3];
                position = ipp[0] * nx + ipp[1] * ny + ipp[2] * nz;
            } else {
                position = attrs.getInt(Tag.InstanceNumber, 0);
            }
        }

        int instanceNumber = attrs.getInt(Tag.InstanceNumber, 0);

        // Extract raw pixel data using ImageIO
        short[] pixels = extractPixels(file, rows, columns);

        return new SliceData(position, pixels, instanceNumber);
    }

    /**
     * Extract raw pixel values from DICOM file
     */
    private short[] extractPixels(File file, int rows, int columns) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            // Read full dataset including pixel data
            dis.setIncludeBulkData(DicomInputStream.IncludeBulkData.YES);
            Attributes attrs = dis.readDataset();

            // Get pixel data from attributes
            byte[] pixelBytes = attrs.getBytes(Tag.PixelData);
            if (pixelBytes == null) {
                log.warn("No pixel data found in file: {}", file.getName());
                return new short[rows * columns]; // Return empty array
            }

            int pixelRepresentation = attrs.getInt(Tag.PixelRepresentation, 0);
            int bitsAllocated = attrs.getInt(Tag.BitsAllocated, 16);

            short[] pixels = new short[rows * columns];

            if (bitsAllocated == 16) {
                // 16-bit pixels - read as little-endian shorts
                ByteBuffer buffer = ByteBuffer.wrap(pixelBytes).order(ByteOrder.LITTLE_ENDIAN);
                int pixelCount = Math.min(pixelBytes.length / 2, pixels.length);

                for (int i = 0; i < pixelCount; i++) {
                    pixels[i] = buffer.getShort();
                }
            } else if (bitsAllocated == 8) {
                // 8-bit pixels
                int pixelCount = Math.min(pixelBytes.length, pixels.length);
                for (int i = 0; i < pixelCount; i++) {
                    pixels[i] = (short) (pixelBytes[i] & 0xFF);
                }
            } else {
                log.warn("Unsupported bits allocated: {}", bitsAllocated);
            }

            return pixels;
        }
    }

    /**
     * Read DICOM attributes from file
     */
    private Attributes readAttributes(File file) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(file)) {
            // Read without pixel data for speed
            dis.setIncludeBulkData(DicomInputStream.IncludeBulkData.NO);
            return dis.readDataset();
        }
    }
}

