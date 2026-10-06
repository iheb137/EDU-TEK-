package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.IndicateurAcademique;

import java.time.LocalDateTime;

public record IndicateurDto(
        Long id,
        String nom,
        Double valeur,
        LocalDateTime dateCalcul,
        Long etudiantId,
        Long semestreId
) {
    public static IndicateurDto from(IndicateurAcademique i) {
        return new IndicateurDto(i.getId(), i.getNom(), i.getValeur(), i.getDateCalcul(),
                i.getEtudiant().getId(), i.getSemestre().getId());
    }
}