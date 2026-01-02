package in.raster.rasterpacs.controller;

import in.raster.rasterpacs.model.AuditLog;
import in.raster.rasterpacs.model.UserSession;
import in.raster.rasterpacs.service.collaboration.AuditService;
import in.raster.rasterpacs.service.collaboration.CollaborationWebSocketHandler;
import in.raster.rasterpacs.service.collaboration.SessionService;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import jakarta.servlet.http.HttpServletRequest;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/**
 * REST Controller for collaboration and session management
 */
@Slf4j
@RestController
@RequestMapping("/api/collaboration")
@CrossOrigin(origins = "*")
public class CollaborationController {

    private final SessionService sessionService;
    private final AuditService auditService;
    private final CollaborationWebSocketHandler webSocketHandler;

    public CollaborationController(SessionService sessionService,
                                    AuditService auditService,
                                    CollaborationWebSocketHandler webSocketHandler) {
        this.sessionService = sessionService;
        this.auditService = auditService;
        this.webSocketHandler = webSocketHandler;
    }

    // ==================== Session Management ====================

    /**
     * Create or join a session
     */
    @PostMapping("/sessions")
    public ResponseEntity<UserSession> createSession(@RequestBody SessionRequest request,
                                                      HttpServletRequest httpRequest) {
        UserSession session = sessionService.createSession(
            request.getSessionId(),
            request.getUserId(),
            request.getUserName(),
            request.getUserRole(),
            getClientIp(httpRequest),
            httpRequest.getHeader("User-Agent")
        );

        auditService.logLogin(request.getUserId(), request.getUserName(),
            request.getSessionId(), httpRequest);

        return ResponseEntity.ok(session);
    }

    /**
     * End a session
     */
    @DeleteMapping("/sessions/{sessionId}")
    public ResponseEntity<Void> endSession(@PathVariable String sessionId,
                                            HttpServletRequest httpRequest) {
        sessionService.getSession(sessionId).ifPresent(session -> {
            auditService.logLogout(session.getUserId(), session.getUserName(),
                sessionId, httpRequest);
        });

        sessionService.endSession(sessionId);
        return ResponseEntity.noContent().build();
    }

    /**
     * Get session info
     */
    @GetMapping("/sessions/{sessionId}")
    public ResponseEntity<UserSession> getSession(@PathVariable String sessionId) {
        return sessionService.getSession(sessionId)
            .map(ResponseEntity::ok)
            .orElse(ResponseEntity.notFound().build());
    }

    /**
     * Update session activity
     */
    @PostMapping("/sessions/{sessionId}/heartbeat")
    public ResponseEntity<Void> heartbeat(@PathVariable String sessionId) {
        sessionService.updateActivity(sessionId);
        return ResponseEntity.ok().build();
    }

    /**
     * Get all active sessions
     */
    @GetMapping("/sessions")
    public ResponseEntity<List<UserSession>> getActiveSessions() {
        return ResponseEntity.ok(sessionService.getActiveSessions());
    }

    /**
     * Get viewers for a study
     */
    @GetMapping("/sessions/study/{studyUid}")
    public ResponseEntity<List<UserSession>> getStudyViewers(@PathVariable String studyUid) {
        return ResponseEntity.ok(sessionService.getStudyViewers(studyUid));
    }

    /**
     * Get session statistics
     */
    @GetMapping("/sessions/stats")
    public ResponseEntity<Map<String, Object>> getSessionStats() {
        return ResponseEntity.ok(sessionService.getSessionStatistics());
    }

    // ==================== Audit Logs ====================

    /**
     * Get audit logs for a study
     */
    @GetMapping("/audit/study/{studyUid}")
    public ResponseEntity<Page<AuditLog>> getStudyAuditLogs(
            @PathVariable String studyUid,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {
        return ResponseEntity.ok(auditService.getStudyAuditLogs(studyUid, page, size));
    }

    /**
     * Get audit logs for a user
     */
    @GetMapping("/audit/user/{userId}")
    public ResponseEntity<Page<AuditLog>> getUserAuditLogs(
            @PathVariable String userId,
            @RequestParam(required = false) LocalDateTime start,
            @RequestParam(required = false) LocalDateTime end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        if (start == null) start = LocalDateTime.now().minusDays(7);
        if (end == null) end = LocalDateTime.now();

        return ResponseEntity.ok(auditService.getUserAuditLogs(userId, start, end, page, size));
    }

    /**
     * Get audit logs for a time range
     */
    @GetMapping("/audit")
    public ResponseEntity<Page<AuditLog>> getAuditLogs(
            @RequestParam(required = false) LocalDateTime start,
            @RequestParam(required = false) LocalDateTime end,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "50") int size) {

        if (start == null) start = LocalDateTime.now().minusDays(1);
        if (end == null) end = LocalDateTime.now();

        return ResponseEntity.ok(auditService.getAuditLogs(start, end, page, size));
    }

    /**
     * Get study access history
     */
    @GetMapping("/audit/study/{studyUid}/access")
    public ResponseEntity<List<AuditLog>> getStudyAccessHistory(@PathVariable String studyUid) {
        return ResponseEntity.ok(auditService.getStudyAccessHistory(studyUid));
    }

    /**
     * Get patient access history
     */
    @GetMapping("/audit/patient/{patientId}/access")
    public ResponseEntity<List<AuditLog>> getPatientAccessHistory(@PathVariable String patientId) {
        return ResponseEntity.ok(auditService.getPatientAccessHistory(patientId));
    }

    /**
     * Get audit statistics
     */
    @GetMapping("/audit/stats")
    public ResponseEntity<Map<String, Object>> getAuditStats(
            @RequestParam(required = false) Integer days) {

        LocalDateTime since = LocalDateTime.now().minusDays(days != null ? days : 7);
        return ResponseEntity.ok(auditService.getAuditStatistics(since));
    }

    // ==================== WebSocket Stats ====================

    /**
     * Get WebSocket connection statistics
     */
    @GetMapping("/websocket/stats")
    public ResponseEntity<Map<String, Object>> getWebSocketStats() {
        return ResponseEntity.ok(Map.of(
            "activeConnections", webSocketHandler.getConnectionCount(),
            "activeSessions", sessionService.getActiveSessionCount(),
            "activeUsers", sessionService.getActiveUserCount()
        ));
    }

    // ==================== Request DTOs ====================

    @lombok.Data
    public static class SessionRequest {
        private String sessionId;
        private String userId;
        private String userName;
        private String userRole;
    }

    // ==================== Helper Methods ====================

    private String getClientIp(HttpServletRequest request) {
        String xForwardedFor = request.getHeader("X-Forwarded-For");
        if (xForwardedFor != null && !xForwardedFor.isEmpty()) {
            return xForwardedFor.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }
}

