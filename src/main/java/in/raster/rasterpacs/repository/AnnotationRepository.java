package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Annotation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

/**
 * Repository for Annotation entity
 */
@Repository
public interface AnnotationRepository extends JpaRepository<Annotation, Long> {

    List<Annotation> findByStudyInstanceUid(String studyInstanceUid);

    List<Annotation> findByStudyInstanceUidAndSeriesInstanceUid(String studyInstanceUid, String seriesInstanceUid);

    List<Annotation> findByStudyInstanceUidAndSeriesInstanceUidAndSopInstanceUid(
            String studyInstanceUid, String seriesInstanceUid, String sopInstanceUid);

    List<Annotation> findBySavedToSrFalse();

    List<Annotation> findBySrInstanceUid(String srInstanceUid);

    void deleteByStudyInstanceUid(String studyInstanceUid);

    void deleteByStudyInstanceUidAndSeriesInstanceUid(String studyInstanceUid, String seriesInstanceUid);
}

