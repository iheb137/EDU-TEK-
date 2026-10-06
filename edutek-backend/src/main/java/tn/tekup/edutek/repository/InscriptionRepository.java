package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Inscription;
import org.springframework.data.jpa.repository.JpaRepository;

public interface InscriptionRepository extends JpaRepository<Inscription, Long> {
    boolean existsByEtudiantIdAndFormationId(Long etudiantId, Long formationId);
}