package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Note;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface NoteRepository extends JpaRepository<Note, Long> {
    boolean existsByEvaluationIdAndEtudiantId(Long evaluationId, Long etudiantId);
    List<Note> findByEvaluationId(Long evaluationId);
    List<Note> findByEtudiantEmail(String email);
    List<Note> findByEtudiantIdAndEvaluationEnseignementId(Long etudiantId, Long enseignementId);
}