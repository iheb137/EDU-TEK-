package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.tekup.edutek.entity.Seance;

import java.time.LocalDate;
import java.util.List;

public interface SeanceRepository extends JpaRepository<Seance, Long> {
    List<Seance> findByDateBetween(LocalDate du, LocalDate au);
    List<Seance> findByEnseignementClasseIdAndDateBetween(Long classeId, LocalDate du, LocalDate au);
    List<Seance> findByEnseignementEnseignantEmailAndDateBetween(String email, LocalDate du, LocalDate au);
}