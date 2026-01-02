package in.raster.rasterpacs.service.collaboration;

import in.raster.rasterpacs.model.AuditLog;
import in.raster.rasterpacs.repository.AuditLogRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.scheduling.annotation.Async;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.*;

/**
 * Service for audit logging and compliance tracking
 */
@Slf4j
@Service
public class AuditService {

    private final AuditLogRepository auditLogRepository;

    // Action types
    public static final String ACTION_VIEW = "VIEW";
    public static final String ACTION_CREATE = "CREATE";
    public static final String ACTION_UPDATE = "UPDATE";
    public static final String ACTION_DELETE = "DELETE";
    public static final String ACTION_EXPORT = "EXPORT";
    public static final String ACTION_SIGN = "SIGN";
    public static final String ACTION_LOGIN = "LOGIN";
    public static final String ACTION_LOGOUT = "LOGOUT";
    public static final String ACTION_PRINT = "PRINT";
    public static final String ACTION_DOWNLOAD = "DOWNLOAD";
    public static final String ACTION_SHARE = "SHARE";

    // Resource types
    public static final String RESOURCE_STUDY = "STUDY";
    public static final String RESOURCE_SERIES = "SERIES";
    public static final String RESOURCE_INSTANCE = "INSTANCE";
    public static final String RESOURCE_REPORT = "REPORT";
    public static final String RESOURCE_ANNOTATION = "ANNOTATION";
    public static final String RESOURCE_SEGMENTATION = "SEGMENTATION";
    public static final String RESOURCE_SESSION = "SESSION";

    public AuditService(AuditLogRepository auditLogRepository) {
        this.auditLogRepository = auditLogRepository;
    }

    /**
     * Log an audit event asynchronously
     */
    @Async
    public void logAsync(AuditLog.AuditLogBuilder builder) {
        try {
            AuditLog log = builder.build();
            auditLogRepository.save(log);
        } catch (Exception e) {
            log.error("Failed to save audit log", e);
        }
    }

    /**
     * Log an audit event synchronously
     */
    @Transactional
    public AuditLog log(AuditLog.AuditLogBuilder builder) {
        AuditLog auditLog = builder.build();
        return auditLogRepository.save(auditLog);
    }

    /**
     * Log a study view event
     */
    public void logStudyView(String userId, String userName, String studyInstanceUid,
                             String patientId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_VIEW)
            .resourceType(RESOURCE_STUDY)
            .studyInstanceUid(studyInstanceUid)
            .patientId(patientId)
            .description("Viewed study")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log a report creation event
     */
    public void logReportCreation(String userId, String userName, String studyInstanceUid,
                                   Long reportId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_CREATE)
            .resourceType(RESOURCE_REPORT)
            .resourceId(reportId.toString())
            .studyInstanceUid(studyInstanceUid)
            .description("Created report")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log a report signing event
     */
    public void logReportSign(String userId, String userName, String studyInstanceUid,
                               Long reportId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_SIGN)
            .resourceType(RESOURCE_REPORT)
            .resourceId(reportId.toString())
            .studyInstanceUid(studyInstanceUid)
            .description("Signed report")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log an export event
     */
    public void logExport(String userId, String userName, String resourceType, String resourceId,
                          String studyInstanceUid, String exportFormat, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_EXPORT)
            .resourceType(resourceType)
            .resourceId(resourceId)
            .studyInstanceUid(studyInstanceUid)
            .description("Exported as " + exportFormat)
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log a login event
     */
    public void logLogin(String userId, String userName, String sessionId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_LOGIN)
            .resourceType(RESOURCE_SESSION)
            .sessionId(sessionId)
            .description("User logged in")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log a logout event
     */
    public void logLogout(String userId, String userName, String sessionId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(ACTION_LOGOUT)
            .resourceType(RESOURCE_SESSION)
            .sessionId(sessionId)
            .description("User logged out")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    /**
     * Log an annotation event
     */
    public void logAnnotation(String userId, String userName, String actionType, String studyInstanceUid,
                               String annotationId, HttpServletRequest request) {
        logAsync(AuditLog.builder()
            .userId(userId)
            .userName(userName)
            .actionType(actionType)
            .resourceType(RESOURCE_ANNOTATION)
            .resourceId(annotationId)
            .studyInstanceUid(studyInstanceUid)
            .description(actionType.toLowerCase() + " annotation")
            .ipAddress(getClientIp(request))
            .userAgent(request != null ? request.getHeader("User-Agent") : null)
            .outcome("SUCCESS"));
    }

    // ==================== Query Methods ====================

    /**
     * Get audit logs for a study
     */
    public Page<AuditLog> getStudyAuditLogs(String studyInstanceUid, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return auditLogRepository.findByStudyInstanceUidOrderByTimestampDesc(studyInstanceUid, pageable);
    }

    /**
     * Get audit logs for a user
     */
    public Page<AuditLog> getUserAuditLogs(String userId, LocalDateTime start, LocalDateTime end,
                                            int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return auditLogRepository.findByUserIdAndTimestampBetween(userId, start, end, pageable);
    }

    /**
     * Get audit logs for a time range
     */
    public Page<AuditLog> getAuditLogs(LocalDateTime start, LocalDateTime end, int page, int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "timestamp"));
        return auditLogRepository.findByTimestampBetween(start, end, pageable);
    }

    /**
     * Get study access history
     */
    public List<AuditLog> getStudyAccessHistory(String studyInstanceUid) {
        return auditLogRepository.findStudyViewHistory(studyInstanceUid);
    }

    /**
     * Get patient access history
     */
    public List<AuditLog> getPatientAccessHistory(String patientId) {
        return auditLogRepository.findByPatientIdOrderByTimestampDesc(patientId);
    }

    /**
     * Get audit statistics
     */
    public Map<String, Object> getAuditStatistics(LocalDateTime since) {
        Map<String, Object> stats = new HashMap<>();

        // Action type counts
        List<Object[]> actionCounts = auditLogRepository.countByActionTypeSince(since);
        Map<String, Long> byAction = new HashMap<>();
        for (Object[] row : actionCounts) {
            byAction.put((String) row[0], (Long) row[1]);
        }
        stats.put("byActionType", byAction);

        // User activity counts
        List<Object[]> userCounts = auditLogRepository.countByUserSince(since);
        List<Map<String, Object>> topUsers = new ArrayList<>();
        int count = 0;
        for (Object[] row : userCounts) {
            if (count++ >= 10) break;
            topUsers.add(Map.of("userId", row[0], "count", row[1]));
        }
        stats.put("topUsers", topUsers);

        // Total count
        stats.put("totalEvents", auditLogRepository.countByTimestampBetween(since, LocalDateTime.now()));

        return stats;
    }

    // ==================== Cleanup ====================

    /**
     * Clean up old audit logs (run daily at 2 AM)
     */
    @Scheduled(cron = "0 0 2 * * ?")
    @Transactional
    public void cleanupOldLogs() {
        // Keep logs for 1 year by default
        LocalDateTime cutoff = LocalDateTime.now().minusYears(1);
        auditLogRepository.deleteByTimestampBefore(cutoff);
        log.info("Cleaned up audit logs older than {}", cutoff);
    }

    // ==================== Helper Methods ====================

    private String getClientIp(HttpServletRequest request) {
        if (request == null) return null;

        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }

        String xRealIp = request.getHeader("X-Real-IP");
        if (xRealIp != null && !xRealIp.isEmpty()) {
            return xRealIp;
        }

        return request.getRemoteAddr();
    }
}

