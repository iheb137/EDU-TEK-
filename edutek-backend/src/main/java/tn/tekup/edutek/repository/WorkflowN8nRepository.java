package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.WorkflowN8n;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface WorkflowN8nRepository extends JpaRepository<WorkflowN8n, Long> {
    Optional<WorkflowN8n> findByNom(String nom);
    List<WorkflowN8n> findAllByOrderByNomAsc();
}