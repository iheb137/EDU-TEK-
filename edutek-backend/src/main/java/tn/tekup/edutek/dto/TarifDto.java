package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.TarifHoraire;

import java.time.LocalDate;

public record TarifDto(Long id, Double montant, LocalDate dateDebut, String grade, Long definiParId) {
    public static TarifDto from(TarifHoraire t) {
        return new TarifDto(t.getId(), t.getMontant(), t.getDateDebut(), t.getGrade(),
                t.getDefiniPar() != null ? t.getDefiniPar().getId() : null);
    }
}