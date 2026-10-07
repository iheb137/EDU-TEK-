package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ActionAccompagnement;

import java.time.LocalDateTime;

public record ActionDto(Long id, Long alerteId, String type, String description, String statut,
                        LocalDateTime dateCreation, Long creeParId) {
    public static ActionDto from(ActionAccompagnement a) {
        return new ActionDto(a.getId(), a.getAlerteRisque().getId(), a.getType(), a.getDescription(),
                a.getStatut(), a.getDateCreation(), a.getCreePar() != null ? a.getCreePar().getId() : null);
    }
}