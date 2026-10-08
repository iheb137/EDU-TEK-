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

    @Query("select a from AlerteRisque a where a.prediction.id in (select p.id from PredictionIA p where p.etudiant.id = :etudiantId and p.semestre.id = :semestreId) and a.statut in :statuts order by a.dateDetection desc, a.id desc")
    List<AlerteRisque> chercherAlertes(@Param("etudiantId") Long etudiantId, @Param("semestreId") Long semestreId, @Param("statuts") Collection<String> statuts);

    default Optional<AlerteRisque> findFirstByPredictionEtudiantIdAndPredictionSemestreIdAndStatutInOrderByDateDetectionDesc(
            Long etudiantId, Long semestreId, Collection<String> statuts) {
        return chercherAlertes(etudiantId, semestreId, statuts).stream().findFirst();
    }

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from AlerteRisque a where a.id = :id")
    Optional<AlerteRisque> findByIdForUpdate(@Param("id") Long id);
}