package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.JustificatifAbsence;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface JustificatifAbsenceRepository extends JpaRepository<JustificatifAbsence, Long> {

    List<JustificatifAbsence> findAllByOrderByDateSoumissionDesc();

    List<JustificatifAbsence> findByEtudiantEmailOrderByDateSoumissionDesc(String email);

    @Query("select count(j) from JustificatifAbsence j where j.etudiant.id = :etudiantId "
         + "and j.statut in ('SOUMIS','VALIDE') and j.dateDebut <= :fin and j.dateFin >= :debut and j.id <> :exclureId")
    long compterChevauchements(@Param("etudiantId") Long etudiantId, @Param("debut") LocalDate debut,
                               @Param("fin") LocalDate fin, @Param("exclureId") Long exclureId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select j from JustificatifAbsence j where j.id = :id")
    Optional<JustificatifAbsence> findByIdForUpdate(@Param("id") Long id);
}