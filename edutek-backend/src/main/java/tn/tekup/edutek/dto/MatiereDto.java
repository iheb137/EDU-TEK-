package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Matiere;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record MatiereDto(
        Long id,
        @NotBlank String code,
        @NotBlank String nom,
        Double coefficient,
        Integer credits,
        @NotNull Long semestreId
) {
    public static MatiereDto from(Matiere m) {
        return new MatiereDto(m.getId(), m.getCode(), m.getNom(), m.getCoefficient(),
                m.getCredits(), m.getSemestre().getId());
    }
}