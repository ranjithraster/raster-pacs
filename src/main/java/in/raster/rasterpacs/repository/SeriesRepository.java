package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Series;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Series entities
 */
@Repository
public interface SeriesRepository extends JpaRepository<Series, Long> {

    Optional<Series> findBySeriesInstanceUid(String seriesInstanceUid);

    boolean existsBySeriesInstanceUid(String seriesInstanceUid);

    List<Series> findByStudyStudyInstanceUid(String studyInstanceUid);

    List<Series> findByModality(String modality);

    List<Series> findByStudyStudyInstanceUidAndModality(String studyInstanceUid, String modality);
}

