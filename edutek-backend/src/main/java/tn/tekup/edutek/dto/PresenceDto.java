package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Presence;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public record PresenceDto(
        Long id,
        @NotNull Boolean present,
        LocalDateTime datePointage,
        String justification,
        @NotNull Long seanceId,
        @NotNull Long etudiantId
) {
    public static PresenceDto from(Presence p) {
        return new PresenceDto(p.getId(), p.getPresent(), p.getDatePointage(), p.getJustification(),
                p.getSeance().getId(), p.getEtudiant().getId());
    }
}