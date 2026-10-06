package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Classe;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public record ClasseDto(
        Long id,
        @NotBlank String code,
        @NotBlank String nom,
        String anneeUniversitaire,
        @NotNull Long formationId
) {
    public static ClasseDto from(Classe c) {
        return new ClasseDto(c.getId(), c.getCode(), c.getNom(), c.getAnneeUniversitaire(), c.getFormation().getId());
    }
}