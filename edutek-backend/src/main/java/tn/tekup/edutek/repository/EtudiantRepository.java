package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Etudiant;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface EtudiantRepository extends JpaRepository<Etudiant, Long> {
    Optional<Etudiant> findByMatricule(String matricule);
    Optional<Etudiant> findByEmail(String email);
    List<Etudiant> findByClasseId(Long classeId);
}