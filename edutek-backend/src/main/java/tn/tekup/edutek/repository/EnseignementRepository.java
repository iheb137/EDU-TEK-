package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Enseignement;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface EnseignementRepository extends JpaRepository<Enseignement, Long> {
    List<Enseignement> findBySemestreId(Long semestreId);
    List<Enseignement> findByClasseIdAndSemestreId(Long classeId, Long semestreId);
}