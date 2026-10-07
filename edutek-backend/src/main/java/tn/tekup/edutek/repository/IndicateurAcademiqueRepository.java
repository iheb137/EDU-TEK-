package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.IndicateurAcademique;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface IndicateurAcademiqueRepository extends JpaRepository<IndicateurAcademique, Long> {
    List<IndicateurAcademique> findByEtudiantIdAndSemestreId(Long etudiantId, Long semestreId);
    List<IndicateurAcademique> findBySemestreId(Long semestreId);
    List<IndicateurAcademique> findByEtudiantEmailAndSemestreId(String email, Long semestreId);
    List<IndicateurAcademique> findByEtudiantId(Long etudiantId);
}