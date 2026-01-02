package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.UserSession;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for UserSession entity
 */
@Repository
public interface UserSessionRepository extends JpaRepository<UserSession, Long> {

    Optional<UserSession> findBySessionId(String sessionId);

    List<UserSession> findByUserId(String userId);

    List<UserSession> findByIsActiveTrue();

    List<UserSession> findByCurrentStudyUidAndIsActiveTrue(String studyInstanceUid);

    List<UserSession> findByCurrentSeriesUidAndIsActiveTrue(String seriesInstanceUid);

    @Query("SELECT s FROM UserSession s WHERE s.isActive = true AND s.currentStudyUid = ?1 AND s.sessionId != ?2")
    List<UserSession> findOtherActiveViewers(String studyInstanceUid, String excludeSessionId);

    @Query("SELECT COUNT(s) FROM UserSession s WHERE s.isActive = true")
    long countActiveSessions();

    @Query("SELECT COUNT(DISTINCT s.userId) FROM UserSession s WHERE s.isActive = true")
    long countActiveUsers();

    @Modifying
    @Query("UPDATE UserSession s SET s.isActive = false, s.disconnectedAt = ?2 WHERE s.lastActivityAt < ?1 AND s.isActive = true")
    int deactivateInactiveSessions(LocalDateTime cutoff, LocalDateTime now);

    @Modifying
    @Query("UPDATE UserSession s SET s.currentStudyUid = ?2, s.currentSeriesUid = ?3, s.lastActivityAt = ?4 WHERE s.sessionId = ?1")
    int updateCurrentStudy(String sessionId, String studyUid, String seriesUid, LocalDateTime now);

    void deleteByDisconnectedAtBefore(LocalDateTime cutoff);
}

