package in.raster.rasterpacs.model;

import jakarta.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

/**
 * Entity for storing PACS node configurations in database
 */
@Data
@Entity
@Table(name = "pacs_nodes", indexes = {
    @Index(name = "idx_pacs_name", columnList = "name"),
    @Index(name = "idx_pacs_active", columnList = "isActive")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PacsNode {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 100)
    private String name;

    @Column(nullable = false, length = 64)
    private String aeTitle;

    @Column(nullable = false, length = 255)
    private String hostname;

    @Column(nullable = false)
    private Integer port;

    @Column(length = 500)
    private String description;

    @Column(length = 20)
    private String queryRetrieveLevel;  // STUDY, SERIES, IMAGE

    @Column
    private boolean isDefault;

    @Column
    private boolean isActive;

    @Column
    private LocalDateTime lastTestedAt;

    @Column(length = 50)
    private String lastTestResult;  // SUCCESS, FAILED, TIMEOUT

    @Column(length = 500)
    private String lastTestMessage;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime modifiedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        modifiedAt = createdAt;
        if (queryRetrieveLevel == null) {
            queryRetrieveLevel = "STUDY";
        }
        isActive = true;
    }

    @PreUpdate
    protected void onUpdate() {
        modifiedAt = LocalDateTime.now();
    }
}

