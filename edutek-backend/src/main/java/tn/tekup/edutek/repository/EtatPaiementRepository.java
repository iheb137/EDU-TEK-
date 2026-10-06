package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.EtatPaiement;
import org.springframework.data.jpa.repository.JpaRepository;

public interface EtatPaiementRepository extends JpaRepository<EtatPaiement, Long> {
}
