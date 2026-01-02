package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Segmentation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Segmentation entity
 */
@Repository
public interface SegmentationRepository extends JpaRepository<Segmentation, Long> {

    List<Segmentation> findByStudyInstanceUid(String studyInstanceUid);

    List<Segmentation> findByReferencedSeriesUid(String referencedSeriesUid);

    List<Segmentation> findByStudyInstanceUidAndReferencedSeriesUid(
            String studyInstanceUid, String referencedSeriesUid);

    Optional<Segmentation> findBySopInstanceUid(String sopInstanceUid);

    List<Segmentation> findBySegmentLabel(String segmentLabel);

    List<Segmentation> findBySegmentCategory(String segmentCategory);

    List<Segmentation> findByCreatedBy(String createdBy);

    List<Segmentation> findByExportedToSegFalse();

    void deleteByStudyInstanceUid(String studyInstanceUid);

    void deleteByReferencedSeriesUid(String referencedSeriesUid);

    long countByStudyInstanceUid(String studyInstanceUid);

    long countByReferencedSeriesUid(String referencedSeriesUid);
}

