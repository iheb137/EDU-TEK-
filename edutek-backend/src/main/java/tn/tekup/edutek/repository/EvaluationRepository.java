package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Evaluation;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EvaluationRepository extends JpaRepository<Evaluation, Long> {
    List<Evaluation> findByEnseignementId(Long enseignementId);
}