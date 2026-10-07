package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ParametresRisque;

import java.time.LocalDateTime;

public record ParametresRisqueDto(Double seuilMoyen, Double seuilEleve, LocalDateTime dateModification, Long modifieParId) {
    public static ParametresRisqueDto from(ParametresRisque p) {
        return new ParametresRisqueDto(p.getSeuilMoyen(), p.getSeuilEleve(), p.getDateModification(),
                p.getModifiePar() != null ? p.getModifiePar().getId() : null);
    }
}