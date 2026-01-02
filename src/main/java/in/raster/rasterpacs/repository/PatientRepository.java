package in.raster.rasterpacs.repository;

import in.raster.rasterpacs.model.Patient;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;

/**
 * Repository for Patient entities
 */
@Repository
public interface PatientRepository extends JpaRepository<Patient, Long> {

    Optional<Patient> findByPatientId(String patientId);

    List<Patient> findByPatientNameContainingIgnoreCase(String patientName);

    boolean existsByPatientId(String patientId);
}

