package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.ModeleIA;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ModeleIARepository extends JpaRepository<ModeleIA, Long> {
    Optional<ModeleIA> findByNomAndVersion(String nom, String version);
    List<ModeleIA> findAllByOrderByIdDesc();
    List<ModeleIA> findByStatut(String statut);
}