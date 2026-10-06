package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Semestre;
import org.springframework.data.jpa.repository.JpaRepository;
import java.time.LocalDate;
import java.util.List;

public interface SemestreRepository extends JpaRepository<Semestre, Long> {
    List<Semestre> findByFormationIdAndDateDebutBeforeOrderByDateDebutDesc(Long formationId, LocalDate date);
}