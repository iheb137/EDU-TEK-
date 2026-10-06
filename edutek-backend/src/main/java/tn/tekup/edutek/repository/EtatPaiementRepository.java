package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.EtatPaiement;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface EtatPaiementRepository extends JpaRepository<EtatPaiement, Long> {

    Optional<EtatPaiement> findByEnseignantIdAndPeriode(Long enseignantId, String periode);

    List<EtatPaiement> findByEnseignantEmailAndStatutInOrderByPeriodeDesc(String email, Collection<String> statuts);

    @Query("select e from EtatPaiement e where (:periode = '' or e.periode = :periode) "
         + "and (:statut = '' or e.statut = :statut) "
         + "and (:enseignantId = 0 or e.enseignant.id = :enseignantId) "
         + "order by e.periode desc, e.id desc")
    List<EtatPaiement> rechercher(@Param("periode") String periode, @Param("statut") String statut,
                                  @Param("enseignantId") long enseignantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select e from EtatPaiement e where e.id = :id")
    Optional<EtatPaiement> findByIdForUpdate(@Param("id") Long id);
}