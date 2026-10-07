package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.ActionAccompagnement;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ActionAccompagnementRepository extends JpaRepository<ActionAccompagnement, Long> {

    List<ActionAccompagnement> findByAlerteRisqueIdOrderByDateCreationDescIdDesc(Long alerteId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from ActionAccompagnement a where a.id = :id")
    Optional<ActionAccompagnement> findByIdForUpdate(@Param("id") Long id);
}