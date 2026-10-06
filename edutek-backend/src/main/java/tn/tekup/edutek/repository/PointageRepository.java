package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Pointage;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PointageRepository extends JpaRepository<Pointage, Long> {

    Optional<Pointage> findBySeanceId(Long seanceId);

    List<Pointage> findBySeanceDateBetweenOrderBySeanceDateDescIdDesc(LocalDate debut, LocalDate fin);

    List<Pointage> findBySeanceEnseignementEnseignantEmailAndSeanceDateBetweenOrderBySeanceDateDescIdDesc(
            String email, LocalDate debut, LocalDate fin);

    List<Pointage> findBySeanceDateBetweenAndStatutIn(LocalDate debut, LocalDate fin, Collection<String> statuts);

    List<Pointage> findBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatutInOrderBySeanceDateAscSeanceHeureDebutAsc(
            Long enseignantId, LocalDate debut, LocalDate fin, Collection<String> statuts);

    long countBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatut(
            Long enseignantId, LocalDate debut, LocalDate fin, String statut);
}