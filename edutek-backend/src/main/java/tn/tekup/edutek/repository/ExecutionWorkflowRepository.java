package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.ExecutionWorkflow;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ExecutionWorkflowRepository extends JpaRepository<ExecutionWorkflow, Long> {
    Optional<ExecutionWorkflow> findByWorkflowIdAndIdExterne(Long workflowId, String idExterne);
    List<ExecutionWorkflow> findByWorkflowIdOrderByDateExecutionDescIdDesc(Long workflowId);
    List<ExecutionWorkflow> findAllByOrderByDateExecutionDescIdDesc(Pageable pageable);
    Optional<ExecutionWorkflow> findFirstByWorkflowIdOrderByDateExecutionDescIdDesc(Long workflowId);
    long countByWorkflowId(Long workflowId);
    long countByWorkflowIdAndStatut(Long workflowId, String statut);
}