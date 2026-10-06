package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Stage;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface StageRepository extends JpaRepository<Stage, Long> {
    List<Stage> findByEtudiantEmailOrderByDateDebutDesc(String email);
    List<Stage> findByStatutOrderByDateDebutDesc(String statut);

    @Query("select count(s) from Stage s where s.etudiant.id = :etudiantId and s.statut <> 'REJETE' "
         + "and s.dateDebut <= :fin and s.dateFin >= :debut and s.id <> :exclureId")
    long compterChevauchements(@Param("etudiantId") Long etudiantId, @Param("debut") LocalDate debut,
                               @Param("fin") LocalDate fin, @Param("exclureId") Long exclureId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Stage s where s.id = :id")
    Optional<Stage> findByIdForUpdate(@Param("id") Long id);
}