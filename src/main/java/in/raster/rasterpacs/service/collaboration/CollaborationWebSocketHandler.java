package in.raster.rasterpacs.service.collaboration;

import in.raster.rasterpacs.dto.AnnotationDto;
import in.raster.rasterpacs.model.UserSession;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.TextWebSocketHandler;

import java.io.IOException;
import java.util.*;
import java.util.concurrent.ConcurrentHashMap;

/**
 * WebSocket handler for real-time collaboration features
 */
@Slf4j
@Service
public class CollaborationWebSocketHandler extends TextWebSocketHandler {

    private final SessionService sessionService;
    private final AuditService auditService;
    private final ObjectMapper objectMapper;

    // Active WebSocket connections by session ID
    private final Map<String, WebSocketSession> connections = new ConcurrentHashMap<>();

    // Sessions grouped by study UID for broadcasting
    private final Map<String, Set<String>> studySubscriptions = new ConcurrentHashMap<>();

    public CollaborationWebSocketHandler(SessionService sessionService,
                                          AuditService auditService,
                                          ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.auditService = auditService;
        this.objectMapper = objectMapper;
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession session) throws Exception {
        String sessionId = session.getId();
        connections.put(sessionId, session);
        log.info("WebSocket connection established: {}", sessionId);

        // Send welcome message
        sendMessage(session, createMessage("connected", Map.of(
            "sessionId", sessionId,
            "message", "Connected to collaboration server"
        )));
    }

    @Override
    protected void handleTextMessage(WebSocketSession session, TextMessage message) throws Exception {
        String sessionId = session.getId();

        try {
            Map<String, Object> payload = objectMapper.readValue(message.getPayload(), Map.class);
            String type = (String) payload.get("type");

            switch (type) {
                case "join" -> handleJoin(session, sessionId, payload);
                case "leave" -> handleLeave(sessionId, payload);
                case "cursor" -> handleCursorMove(sessionId, payload);
                case "scroll" -> handleScroll(sessionId, payload);
                case "annotation" -> handleAnnotation(sessionId, payload);
                case "tool" -> handleToolChange(sessionId, payload);
                case "chat" -> handleChat(sessionId, payload);
                case "ping" -> handlePing(session, sessionId);
                default -> log.warn("Unknown message type: {}", type);
            }
        } catch (Exception e) {
            log.error("Error handling WebSocket message", e);
            sendError(session, "Invalid message format");
        }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession session, CloseStatus status) throws Exception {
        String sessionId = session.getId();
        connections.remove(sessionId);

        // Remove from all study subscriptions
        studySubscriptions.values().forEach(sessions -> sessions.remove(sessionId));

        // Update session status
        sessionService.endSession(sessionId);

        // Notify others
        broadcastToStudy(getSessionStudyUid(sessionId), createMessage("user_left", Map.of(
            "sessionId", sessionId
        )), sessionId);

        log.info("WebSocket connection closed: {} ({})", sessionId, status.getReason());
    }

    // ==================== Message Handlers ====================

    private void handleJoin(WebSocketSession session, String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");
        String userId = (String) payload.get("userId");
        String userName = (String) payload.get("userName");
        String userRole = (String) payload.get("userRole");

        // Create/update session
        UserSession userSession = sessionService.createSession(
            sessionId, userId, userName, userRole, null, null);

        // Update current study
        sessionService.updateCurrentStudy(sessionId, studyUid, (String) payload.get("seriesUid"));

        // Subscribe to study updates
        studySubscriptions.computeIfAbsent(studyUid, k -> ConcurrentHashMap.newKeySet())
            .add(sessionId);

        // Get other viewers
        List<UserSession> otherViewers = sessionService.getOtherViewers(studyUid, sessionId);

        // Send current viewers list
        sendMessage(session, createMessage("viewers", Map.of(
            "viewers", otherViewers.stream().map(this::sessionToMap).toList()
        )));

        // Notify others of new viewer
        broadcastToStudy(studyUid, createMessage("user_joined", Map.of(
            "user", sessionToMap(userSession)
        )), sessionId);

        log.info("User {} joined study {}", userName, studyUid);
    }

    private void handleLeave(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");

        // Remove from subscription
        Set<String> subscribers = studySubscriptions.get(studyUid);
        if (subscribers != null) {
            subscribers.remove(sessionId);
        }

        // Clear current study
        sessionService.updateCurrentStudy(sessionId, null, null);

        // Notify others
        broadcastToStudy(studyUid, createMessage("user_left", Map.of(
            "sessionId", sessionId
        )), sessionId);
    }

    private void handleCursorMove(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");

        // Update session activity
        sessionService.updateActivity(sessionId);

        // Broadcast cursor position to other viewers
        broadcastToStudy(studyUid, createMessage("cursor_move", Map.of(
            "sessionId", sessionId,
            "x", payload.get("x"),
            "y", payload.get("y"),
            "viewportId", payload.getOrDefault("viewportId", 0)
        )), sessionId);
    }

    private void handleScroll(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");
        Integer frameNumber = (Integer) payload.get("frameNumber");

        // Update session
        sessionService.updateCurrentFrame(sessionId, frameNumber);

        // Broadcast scroll position
        broadcastToStudy(studyUid, createMessage("scroll", Map.of(
            "sessionId", sessionId,
            "frameNumber", frameNumber,
            "seriesUid", payload.getOrDefault("seriesUid", ""),
            "viewportId", payload.getOrDefault("viewportId", 0)
        )), sessionId);
    }

    private void handleAnnotation(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");
        String action = (String) payload.get("action"); // create, update, delete

        // Broadcast annotation change
        broadcastToStudy(studyUid, createMessage("annotation", Map.of(
            "sessionId", sessionId,
            "action", action,
            "annotation", payload.get("annotation")
        )), sessionId);

        log.debug("Annotation {} by session {}", action, sessionId);
    }

    private void handleToolChange(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");
        String tool = (String) payload.get("tool");

        // Update session
        sessionService.updateCurrentTool(sessionId, tool);

        // Broadcast tool change (optional - for collaborative awareness)
        broadcastToStudy(studyUid, createMessage("tool_change", Map.of(
            "sessionId", sessionId,
            "tool", tool
        )), sessionId);
    }

    private void handleChat(String sessionId, Map<String, Object> payload) {
        String studyUid = (String) payload.get("studyUid");
        String message = (String) payload.get("message");

        Optional<UserSession> session = sessionService.getSession(sessionId);
        String userName = session.map(UserSession::getUserName).orElse("Unknown");

        // Broadcast chat message
        broadcastToStudy(studyUid, createMessage("chat", Map.of(
            "sessionId", sessionId,
            "userName", userName,
            "message", message,
            "timestamp", System.currentTimeMillis()
        )), null); // Include sender in broadcast
    }

    private void handlePing(WebSocketSession session, String sessionId) {
        sessionService.updateActivity(sessionId);
        sendMessage(session, createMessage("pong", Map.of("timestamp", System.currentTimeMillis())));
    }

    // ==================== Broadcasting ====================

    /**
     * Broadcast message to all viewers of a study
     */
    public void broadcastToStudy(String studyUid, String message, String excludeSessionId) {
        if (studyUid == null) return;

        Set<String> subscribers = studySubscriptions.get(studyUid);
        if (subscribers == null || subscribers.isEmpty()) return;

        for (String sessionId : subscribers) {
            if (sessionId.equals(excludeSessionId)) continue;

            WebSocketSession session = connections.get(sessionId);
            if (session != null && session.isOpen()) {
                sendMessage(session, message);
            }
        }
    }

    /**
     * Broadcast annotation update to study viewers
     */
    public void broadcastAnnotationUpdate(String studyUid, String action, AnnotationDto annotation) {
        try {
            String message = createMessage("annotation", Map.of(
                "action", action,
                "annotation", annotation,
                "timestamp", System.currentTimeMillis()
            ));
            broadcastToStudy(studyUid, message, null);
        } catch (Exception e) {
            log.error("Error broadcasting annotation update", e);
        }
    }

    /**
     * Broadcast to all connected sessions
     */
    public void broadcastToAll(String message) {
        for (WebSocketSession session : connections.values()) {
            if (session.isOpen()) {
                sendMessage(session, message);
            }
        }
    }

    // ==================== Helper Methods ====================

    private void sendMessage(WebSocketSession session, String message) {
        try {
            if (session.isOpen()) {
                session.sendMessage(new TextMessage(message));
            }
        } catch (IOException e) {
            log.error("Error sending WebSocket message", e);
        }
    }

    private void sendError(WebSocketSession session, String error) {
        sendMessage(session, createMessage("error", Map.of("message", error)));
    }

    private String createMessage(String type, Map<String, Object> data) {
        try {
            Map<String, Object> message = new HashMap<>(data);
            message.put("type", type);
            return objectMapper.writeValueAsString(message);
        } catch (Exception e) {
            log.error("Error creating message", e);
            return "{\"type\":\"error\",\"message\":\"Internal error\"}";
        }
    }

    private Map<String, Object> sessionToMap(UserSession session) {
        Map<String, Object> map = new HashMap<>();
        map.put("sessionId", session.getSessionId());
        map.put("userId", session.getUserId());
        map.put("userName", session.getUserName());
        map.put("userRole", session.getUserRole());
        map.put("cursorColor", session.getCursorColor());
        map.put("currentFrame", session.getCurrentFrame());
        map.put("currentTool", session.getCurrentTool());
        return map;
    }

    private String getSessionStudyUid(String sessionId) {
        return sessionService.getSession(sessionId)
            .map(UserSession::getCurrentStudyUid)
            .orElse(null);
    }

    /**
     * Get number of active connections
     */
    public int getConnectionCount() {
        return connections.size();
    }

    /**
     * Get viewers for a study
     */
    public int getStudyViewerCount(String studyUid) {
        Set<String> subscribers = studySubscriptions.get(studyUid);
        return subscribers != null ? subscribers.size() : 0;
    }
}

