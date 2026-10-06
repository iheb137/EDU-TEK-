package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.SuperAdmin;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SuperAdminRepository extends JpaRepository<SuperAdmin, Long> {
}
