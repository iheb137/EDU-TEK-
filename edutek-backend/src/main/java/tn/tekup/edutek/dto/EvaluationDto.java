package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Evaluation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public record EvaluationDto(
        Long id,
        @NotBlank String type,
        LocalDate date,
        Double coefficient,
        @NotNull Long enseignementId,
        LocalTime heureDebut,
        Integer dureeMinutes,
        String salle,
        Boolean anonyme
) {
    public static EvaluationDto from(Evaluation e) {
        return new EvaluationDto(e.getId(), e.getType(), e.getDate(), e.getCoefficient(), e.getEnseignement().getId(),
                e.getHeureDebut(), e.getDureeMinutes(), e.getSalle(), Boolean.TRUE.equals(e.getAnonyme()));
    }
}