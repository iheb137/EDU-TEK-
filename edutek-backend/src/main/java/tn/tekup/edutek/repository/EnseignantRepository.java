package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Enseignant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface EnseignantRepository extends JpaRepository<Enseignant, Long> {
    Optional<Enseignant> findByMatricule(String matricule);
    Optional<Enseignant> findByEmail(String email);
}
