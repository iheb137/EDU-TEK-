package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.AdminPedagogique;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface AdminPedagogiqueRepository extends JpaRepository<AdminPedagogique, Long> {
    Optional<AdminPedagogique> findByEmail(String email);
}