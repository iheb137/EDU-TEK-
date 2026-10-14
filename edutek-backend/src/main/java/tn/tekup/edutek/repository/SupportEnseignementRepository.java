package tn.tekup.edutek.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import tn.tekup.edutek.entity.SupportEnseignement;

import java.util.List;
import java.util.Optional;

public interface SupportEnseignementRepository extends JpaRepository<SupportEnseignement, Long> {
    List<SupportEnseignement> findByEnseignementIdOrderByDateDepotAsc(Long enseignementId);
    List<SupportEnseignement> findByEnseignementIdAndVisibleTrueOrderByDateDepotAsc(Long enseignementId);
    Optional<SupportEnseignement> findByIdAndEnseignementId(Long id, Long enseignementId);
    long countByEnseignementId(Long enseignementId);
    long countByEnseignementIdAndVisibleTrue(Long enseignementId);
}
