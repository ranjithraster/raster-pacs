package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.AuditLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository for AuditLog entity
 */
@Repository
public interface AuditLogRepository extends JpaRepository<AuditLog, Long> {

    List<AuditLog> findByUserId(String userId);

    List<AuditLog> findByStudyInstanceUid(String studyInstanceUid);

    List<AuditLog> findByActionType(String actionType);

    List<AuditLog> findByResourceType(String resourceType);

    Page<AuditLog> findByTimestampBetween(LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<AuditLog> findByUserIdAndTimestampBetween(String userId, LocalDateTime start, LocalDateTime end, Pageable pageable);

    Page<AuditLog> findByStudyInstanceUidOrderByTimestampDesc(String studyInstanceUid, Pageable pageable);

    @Query("SELECT a FROM AuditLog a WHERE a.patientId = ?1 ORDER BY a.timestamp DESC")
    List<AuditLog> findByPatientIdOrderByTimestampDesc(String patientId);

    @Query("SELECT a.actionType, COUNT(a) FROM AuditLog a WHERE a.timestamp >= ?1 GROUP BY a.actionType")
    List<Object[]> countByActionTypeSince(LocalDateTime since);

    @Query("SELECT a.userId, COUNT(a) FROM AuditLog a WHERE a.timestamp >= ?1 GROUP BY a.userId ORDER BY COUNT(a) DESC")
    List<Object[]> countByUserSince(LocalDateTime since);

    @Query("SELECT a FROM AuditLog a WHERE a.actionType = 'VIEW' AND a.studyInstanceUid = ?1 ORDER BY a.timestamp DESC")
    List<AuditLog> findStudyViewHistory(String studyInstanceUid);

    long countByTimestampBetween(LocalDateTime start, LocalDateTime end);

    void deleteByTimestampBefore(LocalDateTime cutoff);
}

