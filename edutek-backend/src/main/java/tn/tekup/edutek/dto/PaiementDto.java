package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.EtatPaiement;

import java.time.LocalDateTime;
import java.util.Comparator;
import java.util.List;

public record PaiementDto(
        Long id, Long enseignantId, String enseignantNom, String periode, Integer minutes, Double montant,
        String statut, LocalDateTime dateGeneration, LocalDateTime dateValidation, LocalDateTime datePaiement,
        List<LignePaiementDto> lignes
) {
    public static PaiementDto from(EtatPaiement e, boolean avecLignes) {
        List<LignePaiementDto> lignes = avecLignes
                ? e.getLignes().stream().map(LignePaiementDto::from)
                        .sorted(Comparator.comparing(LignePaiementDto::date)).toList()
                : null;
        return new PaiementDto(e.getId(), e.getEnseignant().getId(),
                e.getEnseignant().getPrenom() + " " + e.getEnseignant().getNom(),
                e.getPeriode(), e.getMinutes(), e.getMontant(), e.getStatut(),
                e.getDateGeneration(), e.getDateValidation(), e.getDatePaiement(), lignes);
    }
}