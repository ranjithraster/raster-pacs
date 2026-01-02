package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Instance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for Instance entities
 */
@Repository
public interface InstanceRepository extends JpaRepository<Instance, Long> {

    Optional<Instance> findBySopInstanceUid(String sopInstanceUid);

    boolean existsBySopInstanceUid(String sopInstanceUid);

    List<Instance> findBySeriesSeriesInstanceUid(String seriesInstanceUid);

    List<Instance> findBySeriesSeriesInstanceUidOrderByInstanceNumber(String seriesInstanceUid);

    List<Instance> findBySeriesStudyStudyInstanceUid(String studyInstanceUid);

    List<Instance> findBySopClassUid(String sopClassUid);

    long countBySeriesSeriesInstanceUid(String seriesInstanceUid);
}

