package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Inscription;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record InscriptionDto(
        Long id,
        LocalDate dateInscription,
        String statut,
        @NotNull Long etudiantId,
        @NotNull Long formationId
) {
    public static InscriptionDto from(Inscription i) {
        return new InscriptionDto(i.getId(), i.getDateInscription(), i.getStatut(),
                i.getEtudiant().getId(), i.getFormation().getId());
    }
}