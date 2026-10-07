package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AlerteRisque;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface AlerteRisqueRepository extends JpaRepository<AlerteRisque, Long> {

    List<AlerteRisque> findAllByOrderByDateDetectionDescIdDesc();

    Optional<AlerteRisque> findByPredictionId(Long predictionId);

    Optional<AlerteRisque> findFirstByPredictionEtudiantIdAndPredictionSemestreIdAndStatutInOrderByDateDetectionDesc(
            Long etudiantId, Long semestreId, Collection<String> statuts);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AlerteRisque a where a.id = :id")
    Optional<AlerteRisque> findByIdForUpdate(@Param("id") Long id);
}