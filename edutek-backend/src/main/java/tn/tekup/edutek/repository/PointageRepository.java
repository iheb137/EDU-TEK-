package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Pointage;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface PointageRepository extends JpaRepository<Pointage, Long> {

    Optional<Pointage> findBySeanceId(Long seanceId);

    List<Pointage> findBySeanceDateBetweenOrderBySeanceDateDescIdDesc(LocalDate debut, LocalDate fin);

    List<Pointage> findBySeanceEnseignementEnseignantEmailAndSeanceDateBetweenOrderBySeanceDateDescIdDesc(
            String email, LocalDate debut, LocalDate fin);

    List<Pointage> findBySeanceDateBetweenAndStatutIn(LocalDate debut, LocalDate fin, Collection<String> statuts);

    // Requetes explicites : les requetes derivees qui traversent Enseignant (heritage JOINED + @TenantId)
    // generent un filtre d'etablissement sur une table non jointe (erreur SQL "missing FROM-clause entry").
    @Query("select p from Pointage p join p.seance s join s.enseignement e "
            + "where e.enseignant.id = :enseignantId and s.date between :debut and :fin and p.statut in :statuts "
            + "order by s.date asc, s.heureDebut asc")
    List<Pointage> chercherAPayer(@Param("enseignantId") Long enseignantId, @Param("debut") LocalDate debut,
                                  @Param("fin") LocalDate fin, @Param("statuts") Collection<String> statuts);

    @Query("select count(p) from Pointage p join p.seance s join s.enseignement e "
            + "where e.enseignant.id = :enseignantId and s.date between :debut and :fin and p.statut = :statut")
    long compterParStatut(@Param("enseignantId") Long enseignantId, @Param("debut") LocalDate debut,
                          @Param("fin") LocalDate fin, @Param("statut") String statut);

    default List<Pointage> findBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatutInOrderBySeanceDateAscSeanceHeureDebutAsc(
            Long enseignantId, LocalDate debut, LocalDate fin, Collection<String> statuts) {
        return chercherAPayer(enseignantId, debut, fin, statuts);
    }

    default long countBySeanceEnseignementEnseignantIdAndSeanceDateBetweenAndStatut(
            Long enseignantId, LocalDate debut, LocalDate fin, String statut) {
        return compterParStatut(enseignantId, debut, fin, statut);
    }
}