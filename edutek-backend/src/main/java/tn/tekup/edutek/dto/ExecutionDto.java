package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ExecutionWorkflow;

import java.time.LocalDateTime;

public record ExecutionDto(Long id, Long workflowId, String workflow, String statut, String idExterne,
                           Long dureeMs, String resultat, LocalDateTime dateExecution, Long alerteId) {
    public static ExecutionDto from(ExecutionWorkflow e) {
        return new ExecutionDto(e.getId(), e.getWorkflow().getId(), e.getWorkflow().getNom(), e.getStatut(),
                e.getIdExterne(), e.getDureeMs(), e.getResultat(), e.getDateExecution(),
                e.getAlertesTechniques().isEmpty() ? null : e.getAlertesTechniques().get(0).getId());
    }
}