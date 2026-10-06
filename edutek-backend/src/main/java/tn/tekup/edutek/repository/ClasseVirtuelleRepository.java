package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.ClasseVirtuelle;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClasseVirtuelleRepository extends JpaRepository<ClasseVirtuelle, Long> {
    List<ClasseVirtuelle> findAllByOrderByDateHeureDesc();
    List<ClasseVirtuelle> findByEnseignementEnseignantEmailOrderByDateHeureDesc(String email);
    List<ClasseVirtuelle> findByEnseignementClasseIdOrderByDateHeureDesc(Long classeId);
}