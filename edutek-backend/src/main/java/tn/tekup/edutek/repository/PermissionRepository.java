package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
}
