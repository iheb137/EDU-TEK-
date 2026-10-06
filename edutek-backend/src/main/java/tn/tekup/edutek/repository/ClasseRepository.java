package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Classe;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClasseRepository extends JpaRepository<Classe, Long> {
    List<Classe> findByCode(String code);
    List<Classe> findByCodeAndAnneeUniversitaire(String code, String anneeUniversitaire);
}