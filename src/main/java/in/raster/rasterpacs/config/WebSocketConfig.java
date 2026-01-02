package in.raster.rasterpacs.config;

import in.raster.rasterpacs.service.collaboration.CollaborationWebSocketHandler;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.*;

/**
 * WebSocket configuration for real-time retrieve progress updates and collaboration
 */
@Configuration
@EnableWebSocketMessageBroker
@EnableWebSocket
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer, WebSocketConfigurer {

    private final CollaborationWebSocketHandler collaborationHandler;

    public WebSocketConfig(CollaborationWebSocketHandler collaborationHandler) {
        this.collaborationHandler = collaborationHandler;
    }

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable simple in-memory message broker for subscriptions
        config.enableSimpleBroker("/topic");

        // Prefix for messages from clients to server
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // WebSocket endpoint for STOMP with SockJS fallback
        registry.addEndpoint("/ws/stomp")
                .setAllowedOriginPatterns("*")
                .withSockJS();

        // Also allow raw WebSocket connections for STOMP
        registry.addEndpoint("/ws/stomp")
                .setAllowedOriginPatterns("*");
    }

    @Override
    public void registerWebSocketHandlers(WebSocketHandlerRegistry registry) {
        // Collaboration WebSocket endpoint (raw WebSocket)
        registry.addHandler(collaborationHandler, "/ws/collaboration")
                .setAllowedOrigins("*");
    }
}

