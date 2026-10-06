package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Note;
import jakarta.validation.constraints.NotNull;

public record NoteDto(
        Long id,
        @NotNull Double valeur,
        String commentaire,
        @NotNull Long evaluationId,
        @NotNull Long etudiantId
) {
    public static NoteDto from(Note n) {
        return new NoteDto(n.getId(), n.getValeur(), n.getCommentaire(),
                n.getEvaluation().getId(), n.getEtudiant().getId());
    }
}