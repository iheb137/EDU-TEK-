package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.SupportCours;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SupportCoursRepository extends JpaRepository<SupportCours, Long> {
    List<SupportCours> findByClasseVirtuelleIdOrderByDateDepotDesc(Long classeVirtuelleId);
    Optional<SupportCours> findByIdAndClasseVirtuelleId(Long id, Long classeVirtuelleId);
}