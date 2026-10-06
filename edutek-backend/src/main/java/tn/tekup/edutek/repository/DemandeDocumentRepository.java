package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.DemandeDocument;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DemandeDocumentRepository extends JpaRepository<DemandeDocument, Long> {
    List<DemandeDocument> findByEtudiantEmailOrderByDateDemandeDesc(String email);
    List<DemandeDocument> findByStatutOrderByDateDemandeAsc(String statut);
    boolean existsByEtudiantIdAndTypeDocumentAndStatutIn(Long etudiantId, String typeDocument, Collection<String> statuts);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select d from DemandeDocument d where d.id = :id")
    Optional<DemandeDocument> findByIdForUpdate(@Param("id") Long id);
}