package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.TarifHoraire;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface TarifHoraireRepository extends JpaRepository<TarifHoraire, Long> {
    List<TarifHoraire> findAllByOrderByDateDebutDescIdDesc();
}