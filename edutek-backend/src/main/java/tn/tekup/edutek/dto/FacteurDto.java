package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.FacteurExplicatif;

public record FacteurDto(String nom, Double valeur, Double contribution) {
    public static FacteurDto from(FacteurExplicatif f) {
        return new FacteurDto(f.getNom(), f.getValeur(), f.getContribution());
    }
}