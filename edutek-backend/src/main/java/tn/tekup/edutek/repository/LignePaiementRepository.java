package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.LignePaiement;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface LignePaiementRepository extends JpaRepository<LignePaiement, Long> {
    boolean existsByPointageIdAndEtatStatutIn(Long pointageId, Collection<String> statuts);
    boolean existsByTarifId(Long tarifId);
}