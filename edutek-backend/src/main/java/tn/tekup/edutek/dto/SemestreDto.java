package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Semestre;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public record SemestreDto(
        Long id,
        @NotBlank String nom,
        LocalDate dateDebut,
        LocalDate dateFin,
        @NotNull Long formationId
) {
    public static SemestreDto from(Semestre s) {
        return new SemestreDto(s.getId(), s.getNom(), s.getDateDebut(), s.getDateFin(), s.getFormation().getId());
    }
}