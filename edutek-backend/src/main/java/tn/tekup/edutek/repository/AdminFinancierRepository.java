package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AdminFinancier;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminFinancierRepository extends JpaRepository<AdminFinancier, Long> {
    Optional<AdminFinancier> findByEmail(String email);
}