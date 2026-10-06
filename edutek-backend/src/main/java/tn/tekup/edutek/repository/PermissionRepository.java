package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.Permission;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface PermissionRepository extends JpaRepository<Permission, Long> {
    boolean existsByCode(String code);
    List<Permission> findByCodeIn(Collection<String> codes);
}