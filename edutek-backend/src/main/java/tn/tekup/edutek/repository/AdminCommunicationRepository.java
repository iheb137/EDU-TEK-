package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AdminCommunication;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminCommunicationRepository extends JpaRepository<AdminCommunication, Long> {
    Optional<AdminCommunication> findByEmail(String email);
}