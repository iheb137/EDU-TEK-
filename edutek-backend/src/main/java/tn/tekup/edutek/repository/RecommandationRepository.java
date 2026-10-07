package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Recommandation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RecommandationRepository extends JpaRepository<Recommandation, Long> {
    List<Recommandation> findByEtudiantIdAndSemestreId(Long etudiantId, Long semestreId);
    List<Recommandation> findByEtudiantEmailOrderByDateCreationDescIdDesc(String email);
    List<Recommandation> findByEtudiantEmailAndSemestreIdOrderByDateCreationDescIdDesc(String email, Long semestreId);
}