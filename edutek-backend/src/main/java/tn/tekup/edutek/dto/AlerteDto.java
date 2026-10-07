package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.AlerteRisque;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.PredictionIA;

import java.time.LocalDateTime;

public record AlerteDto(
        Long id, Long predictionId, Long etudiantId, String etudiantNom, String etudiantMatricule,
        Long semestreId, String niveau, Double score, String statut, LocalDateTime dateDetection, int nbActions
) {
    public static AlerteDto from(AlerteRisque a) {
        PredictionIA p = a.getPrediction();
        Etudiant e = p.getEtudiant();
        return new AlerteDto(a.getId(), p.getId(), e.getId(), e.getPrenom() + " " + e.getNom(), e.getMatricule(),
                p.getSemestre() != null ? p.getSemestre().getId() : null,
                a.getNiveau(), a.getScore(), a.getStatut(), a.getDateDetection(), a.getActions().size());
    }
}