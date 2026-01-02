package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for storing audit log entries
 */
@Data
@Entity
@Table(name = "audit_logs", indexes = {
    @Index(name = "idx_audit_user", columnList = "userId"),
    @Index(name = "idx_audit_action", columnList = "actionType"),
    @Index(name = "idx_audit_study", columnList = "studyInstanceUid"),
    @Index(name = "idx_audit_timestamp", columnList = "timestamp")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuditLog {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private LocalDateTime timestamp;

    @Column(nullable = false, length = 100)
    private String userId;

    @Column(length = 200)
    private String userName;

    @Column(length = 100)
    private String userRole;

    @Column(nullable = false, length = 50)
    private String actionType;  // VIEW, CREATE, UPDATE, DELETE, EXPORT, SIGN, LOGIN, LOGOUT

    @Column(nullable = false, length = 100)
    private String resourceType;  // STUDY, SERIES, INSTANCE, REPORT, ANNOTATION, SEGMENTATION

    @Column(length = 64)
    private String resourceId;

    @Column(length = 64)
    private String studyInstanceUid;

    @Column(length = 64)
    private String seriesInstanceUid;

    @Column(length = 100)
    private String patientId;

    @Column(length = 500)
    private String description;

    @Column(columnDefinition = "TEXT")
    private String details;  // JSON with additional details

    @Column(length = 50)
    private String ipAddress;

    @Column(length = 500)
    private String userAgent;

    @Column(length = 100)
    private String sessionId;

    @Column(length = 20)
    private String outcome;  // SUCCESS, FAILURE, PARTIAL

    @Column(length = 500)
    private String errorMessage;

    @PrePersist
    protected void onCreate() {
        if (timestamp == null) {
            timestamp = LocalDateTime.now();
        }
    }
}

