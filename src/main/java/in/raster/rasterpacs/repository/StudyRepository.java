package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Study;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository for Study entities
 */
@Repository
public interface StudyRepository extends JpaRepository<Study, Long> {

    Optional<Study> findByStudyInstanceUid(String studyInstanceUid);

    boolean existsByStudyInstanceUid(String studyInstanceUid);

    List<Study> findByPatientPatientId(String patientId);

    List<Study> findByAccessionNumber(String accessionNumber);

    List<Study> findByStudyDateBetween(LocalDate startDate, LocalDate endDate);

    List<Study> findByModalitiesInStudyContaining(String modality);

    @Query("SELECT s FROM Study s WHERE s.cached = true AND s.lastAccessedAt < :cutoffDate")
    List<Study> findCachedStudiesOlderThan(@Param("cutoffDate") LocalDateTime cutoffDate);

    @Query("SELECT s FROM Study s WHERE s.cached = true ORDER BY s.lastAccessedAt ASC")
    List<Study> findCachedStudiesOrderByLastAccessed();

    @Query("SELECT s FROM Study s JOIN s.patient p " +
           "WHERE (:patientId IS NULL OR p.patientId LIKE %:patientId%) " +
           "AND (:patientName IS NULL OR p.patientName LIKE %:patientName%) " +
           "AND (:studyDate IS NULL OR s.studyDate = :studyDate) " +
           "AND (:modality IS NULL OR s.modalitiesInStudy LIKE %:modality%) " +
           "AND (:accessionNumber IS NULL OR s.accessionNumber = :accessionNumber)")
    List<Study> searchStudies(
            @Param("patientId") String patientId,
            @Param("patientName") String patientName,
            @Param("studyDate") LocalDate studyDate,
            @Param("modality") String modality,
            @Param("accessionNumber") String accessionNumber
    );
}

