package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Notification;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.List;

/** File d'envoi des notifications (consommee par n8n). */
public interface NotificationLivraisonRepository extends JpaRepository<Notification, Long> {

    List<Notification> findByEnvoyeLeIsNullOrderByDateEnvoiAscIdAsc(Pageable pageable);

    @Modifying
    @Query("update Notification n set n.envoyeLe = :maintenant where n.envoyeLe is null")
    int amorcer(@Param("maintenant") LocalDateTime maintenant);
}