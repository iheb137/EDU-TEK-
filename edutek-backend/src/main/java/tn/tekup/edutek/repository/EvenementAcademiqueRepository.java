package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.tekup.edutek.entity.EvenementAcademique;

import java.time.LocalDate;
import java.util.List;

public interface EvenementAcademiqueRepository extends JpaRepository<EvenementAcademique, Long> {
    /** Evenements qui chevauchent la periode [du, au]. */
    List<EvenementAcademique> findByDateDebutLessThanEqualAndDateFinGreaterThanEqualOrderByDateDebut(LocalDate au, LocalDate du);
}