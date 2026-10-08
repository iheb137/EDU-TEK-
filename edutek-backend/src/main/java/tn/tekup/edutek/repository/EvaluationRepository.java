package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.tekup.edutek.entity.Evaluation;

import java.time.LocalDate;
import java.util.List;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {
    List<Evaluation> findByEnseignementId(Long enseignementId);
    List<Evaluation> findByDateBetween(LocalDate du, LocalDate au);
    List<Evaluation> findByEnseignementClasseIdAndDateBetween(Long classeId, LocalDate du, LocalDate au);
    List<Evaluation> findByEnseignementEnseignantEmailAndDateBetween(String email, LocalDate du, LocalDate au);
}