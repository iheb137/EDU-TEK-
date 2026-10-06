package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.ResultatSemestre;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface ResultatSemestreRepository extends JpaRepository<ResultatSemestre, Long> {
    Optional<ResultatSemestre> findByEtudiantIdAndSemestreId(Long etudiantId, Long semestreId);
    List<ResultatSemestre> findBySemestreId(Long semestreId);
    List<ResultatSemestre> findByEtudiantEmail(String email);
}