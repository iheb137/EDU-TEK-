package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Stage;

import java.time.LocalDate;

public record StageDto(
        Long id,
        String entreprise,
        String sujet,
        LocalDate dateDebut,
        LocalDate dateFin,
        String statut,
        String motifRejet,
        Long etudiantId,
        String etudiantNom,
        Long valideParId
) {
    public static StageDto from(Stage s) {
        Etudiant e = s.getEtudiant();
        return new StageDto(s.getId(), s.getEntreprise(), s.getSujet(), s.getDateDebut(), s.getDateFin(),
                s.getStatut(), s.getMotifRejet(), e.getId(), e.getPrenom() + " " + e.getNom(),
                s.getValidePar() != null ? s.getValidePar().getId() : null);
    }
}