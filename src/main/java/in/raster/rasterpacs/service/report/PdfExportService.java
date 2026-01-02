package in.raster.rasterpacs.service.report;

import in.raster.rasterpacs.dto.ReportDto;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;

import java.io.*;
import java.nio.charset.StandardCharsets;
import java.time.format.DateTimeFormatter;
import java.util.Base64;

/**
 * Service for exporting reports to PDF format
 * Uses HTML-to-PDF conversion for simplicity and portability
 */
@Slf4j
@Service
public class PdfExportService {

    private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd");
    private static final DateTimeFormatter DATETIME_FORMAT = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm");

    /**
     * Generate PDF from report
     */
    public byte[] generatePdf(ReportDto report) throws IOException {
        log.info("Generating PDF for report: {}", report.getId());

        // Generate HTML content
        String html = generateHtml(report);

        // For a zero-footprint solution, we return HTML that can be converted client-side
        // In production, you could use libraries like Flying Saucer, iText, or wkhtmltopdf
        return convertHtmlToPdf(html);
    }

    /**
     * Generate HTML content for the report
     */
    public String generateHtml(ReportDto report) {
        StringBuilder html = new StringBuilder();

        html.append("<!DOCTYPE html>\n");
        html.append("<html><head>\n");
        html.append("<meta charset=\"UTF-8\">\n");
        html.append("<title>Radiology Report</title>\n");
        html.append("<style>\n");
        html.append(getReportStyles());
        html.append("</style>\n");
        html.append("</head><body>\n");

        // Header
        html.append("<div class=\"report-header\">\n");
        html.append("<div class=\"institution\">").append(escapeHtml(report.getInstitutionName())).append("</div>\n");
        html.append("<h1>RADIOLOGY REPORT</h1>\n");
        html.append("</div>\n");

        // Patient Info
        html.append("<div class=\"patient-info\">\n");
        html.append("<table>\n");
        html.append("<tr><td><strong>Patient Name:</strong></td><td>").append(escapeHtml(report.getPatientName())).append("</td>\n");
        html.append("<td><strong>Patient ID:</strong></td><td>").append(escapeHtml(report.getPatientId())).append("</td></tr>\n");
        html.append("<tr><td><strong>Accession Number:</strong></td><td>").append(escapeHtml(report.getAccessionNumber())).append("</td>\n");
        html.append("<td><strong>Study Date:</strong></td><td>").append(report.getStudyDate() != null ? report.getStudyDate().format(DATE_FORMAT) : "").append("</td></tr>\n");
        html.append("<tr><td><strong>Referring Physician:</strong></td><td>").append(escapeHtml(report.getReferringPhysician())).append("</td>\n");
        html.append("<td><strong>Priority:</strong></td><td>").append(escapeHtml(report.getPriority())).append("</td></tr>\n");
        html.append("</table>\n");
        html.append("</div>\n");

        // Report Content
        html.append("<div class=\"report-content\">\n");

        // Clinical History
        if (report.getClinicalHistory() != null && !report.getClinicalHistory().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>CLINICAL HISTORY</h2>\n");
            html.append("<p>").append(escapeHtml(report.getClinicalHistory())).append("</p>\n");
            html.append("</div>\n");
        }

        // Technique
        if (report.getTechnique() != null && !report.getTechnique().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>TECHNIQUE</h2>\n");
            html.append("<p>").append(escapeHtml(report.getTechnique())).append("</p>\n");
            html.append("</div>\n");
        }

        // Comparison
        if (report.getComparison() != null && !report.getComparison().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>COMPARISON</h2>\n");
            html.append("<p>").append(escapeHtml(report.getComparison())).append("</p>\n");
            html.append("</div>\n");
        }

        // Findings
        if (report.getFindings() != null && !report.getFindings().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>FINDINGS</h2>\n");
            html.append("<div class=\"findings\">").append(formatText(report.getFindings())).append("</div>\n");
            html.append("</div>\n");
        }

        // Measurements
        if (report.getMeasurements() != null && !report.getMeasurements().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>MEASUREMENTS</h2>\n");
            html.append("<table class=\"measurements\">\n");
            html.append("<tr><th>Measurement</th><th>Value</th><th>Location</th></tr>\n");
            for (ReportDto.Measurement m : report.getMeasurements()) {
                html.append("<tr><td>").append(escapeHtml(m.getLabel())).append("</td>");
                html.append("<td>").append(m.getValue()).append(" ").append(m.getUnit()).append("</td>");
                html.append("<td>").append(escapeHtml(m.getLocation())).append("</td></tr>\n");
            }
            html.append("</table>\n");
            html.append("</div>\n");
        }

        // Impression
        if (report.getImpression() != null && !report.getImpression().isEmpty()) {
            html.append("<div class=\"section impression\">\n");
            html.append("<h2>IMPRESSION</h2>\n");
            html.append("<div class=\"impression-text\">").append(formatText(report.getImpression())).append("</div>\n");
            html.append("</div>\n");
        }

        // Recommendations
        if (report.getRecommendations() != null && !report.getRecommendations().isEmpty()) {
            html.append("<div class=\"section\">\n");
            html.append("<h2>RECOMMENDATIONS</h2>\n");
            html.append("<p>").append(escapeHtml(report.getRecommendations())).append("</p>\n");
            html.append("</div>\n");
        }

        html.append("</div>\n");

        // Key Images
        if (report.getKeyImages() != null && !report.getKeyImages().isEmpty()) {
            html.append("<div class=\"key-images\">\n");
            html.append("<h2>KEY IMAGES</h2>\n");
            html.append("<div class=\"images-grid\">\n");
            for (ReportDto.KeyImage img : report.getKeyImages()) {
                html.append("<div class=\"key-image\">\n");
                if (img.getThumbnailBase64() != null) {
                    html.append("<img src=\"data:image/jpeg;base64,").append(img.getThumbnailBase64()).append("\" alt=\"Key Image\">\n");
                }
                html.append("<p>").append(escapeHtml(img.getDescription())).append("</p>\n");
                html.append("</div>\n");
            }
            html.append("</div>\n");
            html.append("</div>\n");
        }

        // Signature
        html.append("<div class=\"signature\">\n");
        if (report.getSignedBy() != null) {
            html.append("<div class=\"signed\">\n");
            html.append("<p><strong>Electronically signed by:</strong></p>\n");
            html.append("<p class=\"physician-name\">").append(escapeHtml(report.getSignedBy())).append("</p>\n");
            html.append("<p class=\"sign-date\">").append(report.getSignedAt() != null ? report.getSignedAt().format(DATETIME_FORMAT) : "").append("</p>\n");
            html.append("</div>\n");
        } else {
            html.append("<div class=\"draft-notice\">\n");
            html.append("<p>*** DRAFT - NOT SIGNED ***</p>\n");
            html.append("</div>\n");
        }
        html.append("<p class=\"reporting-physician\"><strong>Reporting Physician:</strong> ").append(escapeHtml(report.getReportingPhysician())).append("</p>\n");
        html.append("</div>\n");

        // Footer
        html.append("<div class=\"footer\">\n");
        html.append("<p>Report generated: ").append(java.time.LocalDateTime.now().format(DATETIME_FORMAT)).append("</p>\n");
        html.append("<p>Study Instance UID: ").append(report.getStudyInstanceUid()).append("</p>\n");
        html.append("</div>\n");

        html.append("</body></html>");

        return html.toString();
    }

    /**
     * Get CSS styles for the report
     */
    private String getReportStyles() {
        return """
            body {
                font-family: 'Times New Roman', serif;
                font-size: 12pt;
                line-height: 1.4;
                margin: 0;
                padding: 20px 40px;
                color: #000;
            }
            .report-header {
                text-align: center;
                border-bottom: 2px solid #000;
                padding-bottom: 15px;
                margin-bottom: 20px;
            }
            .institution {
                font-size: 16pt;
                font-weight: bold;
                margin-bottom: 5px;
            }
            h1 {
                font-size: 14pt;
                margin: 10px 0;
                letter-spacing: 2px;
            }
            .patient-info {
                margin-bottom: 20px;
                padding: 10px;
                background: #f5f5f5;
                border: 1px solid #ccc;
            }
            .patient-info table {
                width: 100%;
                border-collapse: collapse;
            }
            .patient-info td {
                padding: 5px 10px;
            }
            .section {
                margin-bottom: 15px;
            }
            h2 {
                font-size: 12pt;
                font-weight: bold;
                margin: 15px 0 8px 0;
                text-transform: uppercase;
                border-bottom: 1px solid #ccc;
                padding-bottom: 3px;
            }
            .section p, .findings, .impression-text {
                margin: 0;
                text-align: justify;
                white-space: pre-wrap;
            }
            .impression {
                background: #ffffd0;
                padding: 10px;
                border-left: 4px solid #ffd700;
            }
            .measurements {
                width: 100%;
                border-collapse: collapse;
                margin-top: 10px;
            }
            .measurements th, .measurements td {
                border: 1px solid #ccc;
                padding: 5px 10px;
                text-align: left;
            }
            .measurements th {
                background: #f0f0f0;
            }
            .key-images {
                margin-top: 20px;
                page-break-before: auto;
            }
            .images-grid {
                display: flex;
                flex-wrap: wrap;
                gap: 15px;
            }
            .key-image {
                width: 200px;
                text-align: center;
            }
            .key-image img {
                max-width: 100%;
                border: 1px solid #ccc;
            }
            .key-image p {
                font-size: 10pt;
                margin-top: 5px;
            }
            .signature {
                margin-top: 30px;
                padding-top: 20px;
                border-top: 1px solid #ccc;
            }
            .signed {
                margin-bottom: 10px;
            }
            .physician-name {
                font-size: 14pt;
                font-weight: bold;
                margin: 5px 0;
            }
            .sign-date {
                font-size: 10pt;
                color: #666;
            }
            .draft-notice {
                color: red;
                font-weight: bold;
                font-size: 14pt;
                text-align: center;
                padding: 10px;
                border: 2px solid red;
                margin: 10px 0;
            }
            .footer {
                margin-top: 30px;
                padding-top: 10px;
                border-top: 1px solid #ccc;
                font-size: 9pt;
                color: #666;
            }
            @media print {
                body { margin: 0; padding: 15px; }
                .impression { -webkit-print-color-adjust: exact; }
            }
            """;
    }

    /**
     * Convert HTML to PDF bytes
     * This is a simplified version - in production use a proper PDF library
     */
    private byte[] convertHtmlToPdf(String html) throws IOException {
        // For zero-footprint, we return HTML with print styles
        // The client can use window.print() or a library like jsPDF/html2pdf

        // Add print-specific wrapper
        String printableHtml = html.replace("</head>",
            "<script>window.onload = function() { if(window.printMode) window.print(); }</script></head>");

        return printableHtml.getBytes(StandardCharsets.UTF_8);
    }

    /**
     * Format text with line breaks
     */
    private String formatText(String text) {
        if (text == null) return "";
        return escapeHtml(text).replace("\n", "<br>");
    }

    /**
     * Escape HTML special characters
     */
    private String escapeHtml(String text) {
        if (text == null) return "";
        return text
            .replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
            .replace("\"", "&quot;")
            .replace("'", "&#39;");
    }

    /**
     * Generate report as downloadable HTML file
     */
    public byte[] generateDownloadableHtml(ReportDto report) {
        String html = generateHtml(report);
        return html.getBytes(StandardCharsets.UTF_8);
    }
}

