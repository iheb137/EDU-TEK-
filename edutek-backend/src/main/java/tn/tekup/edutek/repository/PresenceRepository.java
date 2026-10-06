package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Presence;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface PresenceRepository extends JpaRepository<Presence, Long> {
    boolean existsBySeanceIdAndEtudiantId(Long seanceId, Long etudiantId);
    List<Presence> findBySeanceId(Long seanceId);
    List<Presence> findByEtudiantEmail(String email);
    List<Presence> findByEtudiantIdAndSeanceEnseignementSemestreId(Long etudiantId, Long semestreId);
}