package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.LignePaiement;

import java.time.LocalDate;

public record LignePaiementDto(Long pointageId, LocalDate date, String matiereNom, Integer minutes,
                               Double tarifHoraire, Double montant) {
    public static LignePaiementDto from(LignePaiement l) {
        return new LignePaiementDto(l.getPointage().getId(), l.getPointage().getSeance().getDate(),
                l.getPointage().getSeance().getEnseignement().getMatiere().getNom(),
                l.getMinutes(), l.getTarifHoraire(), l.getMontant());
    }
}