package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AlerteTechnique;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AlerteTechniqueRepository extends JpaRepository<AlerteTechnique, Long> {

    List<AlerteTechnique> findAllByOrderByDateCreationDescIdDesc();

    boolean existsByTypeAndStatutInAndExecutionWorkflowId(String type, Collection<String> statuts, Long workflowId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AlerteTechnique a where a.id = :id")
    Optional<AlerteTechnique> findByIdForUpdate(@Param("id") Long id);
}