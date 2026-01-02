package in.raster.rasterpacs.service.collaboration;

import in.raster.rasterpacs.model.UserSession;
import in.raster.rasterpacs.repository.UserSessionRepository;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * Service for managing user sessions and presence
 */
@Slf4j
@Service
public class SessionService {

    private final UserSessionRepository sessionRepository;

    // In-memory cache of active sessions for fast lookup
    private final Map<String, UserSession> activeSessionsCache = new ConcurrentHashMap<>();

    // Color palette for user cursors
    private static final String[] CURSOR_COLORS = {
        "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4", "#FFEAA7",
        "#DDA0DD", "#98D8C8", "#F7DC6F", "#BB8FCE", "#85C1E9"
    };
    private int colorIndex = 0;

    public SessionService(UserSessionRepository sessionRepository) {
        this.sessionRepository = sessionRepository;
    }

    /**
     * Create or update a session
     */
    @Transactional
    public UserSession createSession(String sessionId, String userId, String userName,
                                      String userRole, String ipAddress, String userAgent) {
        // Check if session already exists
        Optional<UserSession> existing = sessionRepository.findBySessionId(sessionId);
        if (existing.isPresent()) {
            UserSession session = existing.get();
            session.setActive(true);
            session.updateActivity();
            activeSessionsCache.put(sessionId, session);
            return sessionRepository.save(session);
        }

        // Create new session
        UserSession session = UserSession.builder()
            .sessionId(sessionId)
            .userId(userId)
            .userName(userName)
            .userRole(userRole)
            .ipAddress(ipAddress)
            .userAgent(userAgent)
            .isActive(true)
            .cursorColor(getNextColor())
            .build();

        session = sessionRepository.save(session);
        activeSessionsCache.put(sessionId, session);

        log.info("Created session {} for user {}", sessionId, userId);
        return session;
    }

    /**
     * Update session activity
     */
    @Transactional
    public void updateActivity(String sessionId) {
        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            cached.updateActivity();
            sessionRepository.save(cached);
        } else {
            sessionRepository.findBySessionId(sessionId).ifPresent(session -> {
                session.updateActivity();
                sessionRepository.save(session);
                activeSessionsCache.put(sessionId, session);
            });
        }
    }

    /**
     * Update current study being viewed
     */
    @Transactional
    public void updateCurrentStudy(String sessionId, String studyUid, String seriesUid) {
        LocalDateTime now = LocalDateTime.now();
        sessionRepository.updateCurrentStudy(sessionId, studyUid, seriesUid, now);

        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            cached.setCurrentStudyUid(studyUid);
            cached.setCurrentSeriesUid(seriesUid);
            cached.setLastActivityAt(now);
        }
    }

    /**
     * Update current frame/slice
     */
    @Transactional
    public void updateCurrentFrame(String sessionId, Integer frameNumber) {
        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            cached.setCurrentFrame(frameNumber);
            cached.updateActivity();
            sessionRepository.save(cached);
        }
    }

    /**
     * Update current tool
     */
    @Transactional
    public void updateCurrentTool(String sessionId, String tool) {
        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            cached.setCurrentTool(tool);
            cached.updateActivity();
            sessionRepository.save(cached);
        }
    }

    /**
     * End a session
     */
    @Transactional
    public void endSession(String sessionId) {
        sessionRepository.findBySessionId(sessionId).ifPresent(session -> {
            session.disconnect();
            sessionRepository.save(session);
        });
        activeSessionsCache.remove(sessionId);
        log.info("Ended session {}", sessionId);
    }

    /**
     * Get session by ID
     */
    public Optional<UserSession> getSession(String sessionId) {
        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            return Optional.of(cached);
        }
        return sessionRepository.findBySessionId(sessionId);
    }

    /**
     * Get all active sessions
     */
    public List<UserSession> getActiveSessions() {
        return sessionRepository.findByIsActiveTrue();
    }

    /**
     * Get active viewers for a study
     */
    public List<UserSession> getStudyViewers(String studyInstanceUid) {
        return sessionRepository.findByCurrentStudyUidAndIsActiveTrue(studyInstanceUid);
    }

    /**
     * Get other active viewers (excluding current session)
     */
    public List<UserSession> getOtherViewers(String studyInstanceUid, String excludeSessionId) {
        return sessionRepository.findOtherActiveViewers(studyInstanceUid, excludeSessionId);
    }

    /**
     * Get active session count
     */
    public long getActiveSessionCount() {
        return sessionRepository.countActiveSessions();
    }

    /**
     * Get active user count
     */
    public long getActiveUserCount() {
        return sessionRepository.countActiveUsers();
    }

    /**
     * Check if session is active
     */
    public boolean isSessionActive(String sessionId) {
        UserSession cached = activeSessionsCache.get(sessionId);
        if (cached != null) {
            return cached.isActive();
        }
        return sessionRepository.findBySessionId(sessionId)
            .map(UserSession::isActive)
            .orElse(false);
    }

    /**
     * Get session statistics
     */
    public Map<String, Object> getSessionStatistics() {
        Map<String, Object> stats = new HashMap<>();
        stats.put("activeSessions", getActiveSessionCount());
        stats.put("activeUsers", getActiveUserCount());

        // Sessions by study
        Map<String, Integer> byStudy = new HashMap<>();
        for (UserSession session : getActiveSessions()) {
            if (session.getCurrentStudyUid() != null) {
                byStudy.merge(session.getCurrentStudyUid(), 1, Integer::sum);
            }
        }
        stats.put("sessionsByStudy", byStudy);

        return stats;
    }

    /**
     * Cleanup inactive sessions (run every 5 minutes)
     */
    @Scheduled(fixedRate = 300000)
    @Transactional
    public void cleanupInactiveSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusMinutes(30);
        int deactivated = sessionRepository.deactivateInactiveSessions(cutoff, LocalDateTime.now());

        if (deactivated > 0) {
            log.info("Deactivated {} inactive sessions", deactivated);

            // Update cache
            activeSessionsCache.entrySet().removeIf(entry ->
                entry.getValue().getLastActivityAt().isBefore(cutoff));
        }
    }

    /**
     * Cleanup old disconnected sessions (run daily)
     */
    @Scheduled(cron = "0 0 3 * * ?")
    @Transactional
    public void cleanupOldSessions() {
        LocalDateTime cutoff = LocalDateTime.now().minusDays(30);
        sessionRepository.deleteByDisconnectedAtBefore(cutoff);
        log.info("Cleaned up sessions disconnected before {}", cutoff);
    }

    /**
     * Get next cursor color
     */
    private synchronized String getNextColor() {
        String color = CURSOR_COLORS[colorIndex % CURSOR_COLORS.length];
        colorIndex++;
        return color;
    }
}

