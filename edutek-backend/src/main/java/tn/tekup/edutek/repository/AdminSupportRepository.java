package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AdminSupport;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminSupportRepository extends JpaRepository<AdminSupport, Long> {
    Optional<AdminSupport> findByEmail(String email);
}