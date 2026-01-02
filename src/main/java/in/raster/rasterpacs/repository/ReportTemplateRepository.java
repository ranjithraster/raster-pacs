package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.ReportTemplate;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository for ReportTemplate entity
 */
@Repository
public interface ReportTemplateRepository extends JpaRepository<ReportTemplate, Long> {

    Optional<ReportTemplate> findByTemplateId(String templateId);

    List<ReportTemplate> findByCategory(String category);

    List<ReportTemplate> findByModality(String modality);

    List<ReportTemplate> findByBodyPart(String bodyPart);

    List<ReportTemplate> findByIsActiveTrue();

    List<ReportTemplate> findByIsActiveTrueOrderBySortOrderAsc();

    List<ReportTemplate> findByCategoryAndIsActiveTrue(String category);

    List<ReportTemplate> findByModalityAndIsActiveTrue(String modality);

    @Query("SELECT t FROM ReportTemplate t WHERE t.isDefault = true AND t.modality = ?1")
    Optional<ReportTemplate> findDefaultForModality(String modality);

    @Query("SELECT t FROM ReportTemplate t WHERE t.isDefault = true AND t.category = ?1")
    Optional<ReportTemplate> findDefaultForCategory(String category);

    @Query("SELECT DISTINCT t.category FROM ReportTemplate t WHERE t.isActive = true")
    List<String> findDistinctCategories();

    @Query("SELECT DISTINCT t.modality FROM ReportTemplate t WHERE t.isActive = true")
    List<String> findDistinctModalities();

    boolean existsByTemplateId(String templateId);
}

