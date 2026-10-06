package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Seance;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record SeanceDto(
        Long id,
        @NotNull LocalDate date,
        @NotNull LocalTime heureDebut,
        @NotNull LocalTime heureFin,
        String salle,
        @NotNull Long enseignementId
) {
    public static SeanceDto from(Seance s) {
        return new SeanceDto(s.getId(), s.getDate(), s.getHeureDebut(), s.getHeureFin(),
                s.getSalle(), s.getEnseignement().getId());
    }
}