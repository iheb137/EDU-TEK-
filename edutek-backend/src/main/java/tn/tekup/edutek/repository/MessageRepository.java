package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Message;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.List;

public interface MessageRepository extends JpaRepository<Message, Long> {
    List<Message> findByDestinataireEmailOrderByDateEnvoiDesc(String email);
    List<Message> findByExpediteurEmailOrderByDateEnvoiDesc(String email);
    long countByDestinataireEmailAndLuFalse(String email);
}