package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for tracking user sessions and active viewers
 */
@Data
@Entity
@Table(name = "user_sessions", indexes = {
    @Index(name = "idx_session_user", columnList = "userId"),
    @Index(name = "idx_session_study", columnList = "currentStudyUid"),
    @Index(name = "idx_session_active", columnList = "isActive")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserSession {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String sessionId;

    @Column(nullable = false, length = 100)
    private String userId;

    @Column(length = 200)
    private String userName;

    @Column(length = 100)
    private String userRole;

    @Column(length = 50)
    private String ipAddress;

    @Column(length = 500)
    private String userAgent;

    @Column
    private boolean isActive;

    @Column(length = 64)
    private String currentStudyUid;

    @Column(length = 64)
    private String currentSeriesUid;

    @Column(length = 100)
    private String currentTool;

    @Column
    private Integer currentFrame;

    @Column(length = 7)
    private String cursorColor;  // Hex color for cursor display

    @Column(nullable = false)
    private LocalDateTime connectedAt;

    private LocalDateTime lastActivityAt;

    private LocalDateTime disconnectedAt;

    @PrePersist
    protected void onCreate() {
        connectedAt = LocalDateTime.now();
        lastActivityAt = connectedAt;
        isActive = true;
    }

    public void updateActivity() {
        this.lastActivityAt = LocalDateTime.now();
    }

    public void disconnect() {
        this.isActive = false;
        this.disconnectedAt = LocalDateTime.now();
    }
}

