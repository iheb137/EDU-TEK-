package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Notification;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {
    List<Notification> findByDestinataireEmailOrderByDateEnvoiDesc(String email);
    List<Notification> findByDestinataireEmailAndLueFalse(String email);
    long countByDestinataireEmailAndLueFalse(String email);
    Optional<Notification> findByIdAndDestinataireEmail(Long id, String email);
}