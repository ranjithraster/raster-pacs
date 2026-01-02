package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Report;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for Report entity
 */
@Repository
public interface ReportRepository extends JpaRepository<Report, Long> {

    List<Report> findByStudyInstanceUid(String studyInstanceUid);

    Optional<Report> findByStudyInstanceUidAndStatus(String studyInstanceUid, String status);

    List<Report> findByPatientId(String patientId);

    List<Report> findByAccessionNumber(String accessionNumber);

    List<Report> findByStatus(String status);

    List<Report> findByReportingPhysician(String reportingPhysician);

    List<Report> findByCreatedBy(String createdBy);

    List<Report> findByStatusAndCreatedAtBetween(String status, LocalDateTime start, LocalDateTime end);

    @Query("SELECT r FROM Report r WHERE r.status = 'DRAFT' AND r.createdBy = ?1 ORDER BY r.modifiedAt DESC")
    List<Report> findDraftsByUser(String userId);

    @Query("SELECT r FROM Report r WHERE r.status = 'PRELIMINARY' ORDER BY r.createdAt ASC")
    List<Report> findPendingReports();

    @Query("SELECT r FROM Report r WHERE r.studyInstanceUid = ?1 ORDER BY r.version DESC")
    List<Report> findReportVersions(String studyInstanceUid);

    long countByStatus(String status);

    long countByCreatedAtBetween(LocalDateTime start, LocalDateTime end);

    void deleteByStudyInstanceUid(String studyInstanceUid);
}

