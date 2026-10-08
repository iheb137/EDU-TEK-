package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.AlerteTechnique;

import java.time.LocalDateTime;

public record AlerteTechniqueDto(Long id, String type, String niveau, String statut, String message, String source,
                                 LocalDateTime dateCreation, LocalDateTime dateTraitement,
                                 Long executionId, Long superviseParId) {
    public static AlerteTechniqueDto from(AlerteTechnique a) {
        return new AlerteTechniqueDto(a.getId(), a.getType(), a.getNiveau(), a.getStatut(), a.getMessage(),
                a.getSource(), a.getDateCreation(), a.getDateTraitement(),
                a.getExecution() != null ? a.getExecution().getId() : null,
                a.getSupervisePar() != null ? a.getSupervisePar().getId() : null);
    }
}