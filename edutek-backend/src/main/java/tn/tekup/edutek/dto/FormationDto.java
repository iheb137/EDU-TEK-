package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Formation;
import jakarta.validation.constraints.NotBlank;

public record FormationDto(
        Long id,
        @NotBlank String code,
        @NotBlank String nom,
        String niveau
) {
    public static FormationDto from(Formation f) {
        return new FormationDto(f.getId(), f.getCode(), f.getNom(), f.getNiveau());
    }
}