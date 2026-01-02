package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.PacsNode;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for PacsNode entity
 */
@Repository
public interface PacsNodeRepository extends JpaRepository<PacsNode, Long> {

    Optional<PacsNode> findByName(String name);

    Optional<PacsNode> findByAeTitle(String aeTitle);

    List<PacsNode> findByIsActiveTrue();

    List<PacsNode> findByIsActiveTrueOrderByNameAsc();

    Optional<PacsNode> findByIsDefaultTrue();

    boolean existsByName(String name);

    boolean existsByAeTitle(String aeTitle);
}

