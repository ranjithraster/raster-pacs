package in.raster.rasterpacs.service.dicom;

import lombok.extern.slf4j.Slf4j;
import org.dcm4che3.data.Attributes;
import org.dcm4che3.data.Tag;
import org.dcm4che3.data.UID;
import org.dcm4che3.imageio.plugins.dcm.DicomImageReadParam;
import org.dcm4che3.io.DicomInputStream;
import org.springframework.stereotype.Service;

import javax.imageio.ImageIO;
import javax.imageio.ImageReadParam;
import javax.imageio.ImageReader;
import javax.imageio.stream.ImageInputStream;
import java.awt.*;
import java.awt.image.BufferedImage;
import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.IOException;
import java.util.Iterator;

/**
 * Service for rendering DICOM images to web-friendly formats
 */
@Slf4j
@Service
public class ImageRenderService {

    /**
     * Render a DICOM image to JPEG
     */
    public byte[] renderToJpeg(File dicomFile, RenderParams params) throws IOException {
        BufferedImage image = renderImage(dicomFile, params);
        return encodeJpeg(image, params.getQuality());
    }

    /**
     * Render a DICOM image to PNG
     */
    public byte[] renderToPng(File dicomFile, RenderParams params) throws IOException {
        BufferedImage image = renderImage(dicomFile, params);
        return encodePng(image);
    }

    /**
     * Render a specific frame from multi-frame DICOM
     */
    public byte[] renderFrame(File dicomFile, int frameNumber, RenderParams params) throws IOException {
        BufferedImage image = renderImage(dicomFile, frameNumber, params);

        if ("image/png".equals(params.getContentType())) {
            return encodePng(image);
        }
        return encodeJpeg(image, params.getQuality());
    }

    /**
     * Generate a thumbnail for a DICOM instance
     */
    public byte[] generateThumbnail(File dicomFile, int maxSize) throws IOException {
        RenderParams params = new RenderParams();
        params.setRows(maxSize);
        params.setColumns(maxSize);
        params.setQuality(70);

        BufferedImage image = renderImage(dicomFile, params);

        // Scale to thumbnail size while maintaining aspect ratio
        int width = image.getWidth();
        int height = image.getHeight();

        if (width > maxSize || height > maxSize) {
            double scale = Math.min((double) maxSize / width, (double) maxSize / height);
            int newWidth = (int) (width * scale);
            int newHeight = (int) (height * scale);

            BufferedImage thumbnail = new BufferedImage(newWidth, newHeight, BufferedImage.TYPE_INT_RGB);
            Graphics2D g = thumbnail.createGraphics();
            g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
            g.drawImage(image, 0, 0, newWidth, newHeight, null);
            g.dispose();

            image = thumbnail;
        }

        return encodeJpeg(image, 70);
    }

    /**
     * Render DICOM image with parameters
     */
    private BufferedImage renderImage(File dicomFile, RenderParams params) throws IOException {
        return renderImage(dicomFile, 0, params);
    }

    /**
     * Render specific frame with parameters
     */
    private BufferedImage renderImage(File dicomFile, int frameNumber, RenderParams params) throws IOException {
        Iterator<ImageReader> readers = ImageIO.getImageReadersByFormatName("DICOM");
        if (!readers.hasNext()) {
            throw new IOException("No DICOM ImageReader found");
        }

        ImageReader reader = readers.next();

        try (ImageInputStream iis = ImageIO.createImageInputStream(dicomFile)) {
            reader.setInput(iis);

            DicomImageReadParam readParam = (DicomImageReadParam) reader.getDefaultReadParam();

            // Apply window/level if specified
            if (params.getWindowCenter() != null && params.getWindowWidth() != null) {
                readParam.setWindowCenter(params.getWindowCenter().floatValue());
                readParam.setWindowWidth(params.getWindowWidth().floatValue());
            } else {
                // Use auto windowing
                readParam.setAutoWindowing(true);
            }

            // Read the image
            BufferedImage image = reader.read(frameNumber, readParam);

            // Scale if requested
            if (params.getRows() != null && params.getColumns() != null &&
                (params.getRows() != image.getHeight() || params.getColumns() != image.getWidth())) {
                image = scaleImage(image, params.getColumns(), params.getRows());
            }

            return image;
        } finally {
            reader.dispose();
        }
    }

    /**
     * Scale image to specified dimensions
     */
    private BufferedImage scaleImage(BufferedImage original, int width, int height) {
        BufferedImage scaled = new BufferedImage(width, height, BufferedImage.TYPE_INT_RGB);
        Graphics2D g = scaled.createGraphics();
        g.setRenderingHint(RenderingHints.KEY_INTERPOLATION, RenderingHints.VALUE_INTERPOLATION_BILINEAR);
        g.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        g.drawImage(original, 0, 0, width, height, null);
        g.dispose();
        return scaled;
    }

    /**
     * Encode BufferedImage to JPEG bytes
     */
    private byte[] encodeJpeg(BufferedImage image, int quality) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();

        // Get JPEG writer
        Iterator<javax.imageio.ImageWriter> writers = ImageIO.getImageWritersByFormatName("jpeg");
        if (!writers.hasNext()) {
            throw new IOException("No JPEG writer found");
        }

        javax.imageio.ImageWriter writer = writers.next();
        try {
            javax.imageio.stream.ImageOutputStream ios = ImageIO.createImageOutputStream(baos);
            writer.setOutput(ios);

            // Set quality
            javax.imageio.plugins.jpeg.JPEGImageWriteParam jpegParams =
                    new javax.imageio.plugins.jpeg.JPEGImageWriteParam(null);
            jpegParams.setCompressionMode(javax.imageio.ImageWriteParam.MODE_EXPLICIT);
            jpegParams.setCompressionQuality(quality / 100.0f);

            // Convert to RGB if necessary
            BufferedImage rgbImage = image;
            if (image.getType() != BufferedImage.TYPE_INT_RGB) {
                rgbImage = new BufferedImage(image.getWidth(), image.getHeight(), BufferedImage.TYPE_INT_RGB);
                Graphics2D g = rgbImage.createGraphics();
                g.drawImage(image, 0, 0, null);
                g.dispose();
            }

            writer.write(null, new javax.imageio.IIOImage(rgbImage, null, null), jpegParams);
            ios.close();
        } finally {
            writer.dispose();
        }

        return baos.toByteArray();
    }

    /**
     * Encode BufferedImage to PNG bytes
     */
    private byte[] encodePng(BufferedImage image) throws IOException {
        ByteArrayOutputStream baos = new ByteArrayOutputStream();
        ImageIO.write(image, "PNG", baos);
        return baos.toByteArray();
    }

    /**
     * Get number of frames in a DICOM file
     */
    public int getFrameCount(File dicomFile) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(dicomFile)) {
            Attributes attrs = dis.readDataset();
            return attrs.getInt(Tag.NumberOfFrames, 1);
        }
    }

    /**
     * Get image dimensions from DICOM file
     */
    public int[] getImageDimensions(File dicomFile) throws IOException {
        try (DicomInputStream dis = new DicomInputStream(dicomFile)) {
            Attributes attrs = dis.readDataset();
            return new int[] {
                attrs.getInt(Tag.Columns, 0),
                attrs.getInt(Tag.Rows, 0)
            };
        }
    }

    /**
     * Render parameters
     */
    @lombok.Data
    public static class RenderParams {
        private Double windowCenter;
        private Double windowWidth;
        private Integer rows;
        private Integer columns;
        private Integer quality = 90;
        private String contentType = "image/jpeg";
        private Boolean invert = false;
    }
}

