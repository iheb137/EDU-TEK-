package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.PredictionIA;

import java.time.LocalDateTime;
import java.util.List;

public record PredictionDto(
        Long id, Long etudiantId, String etudiantNom, String etudiantMatricule, Long semestreId,
        String type, Double probabilite, String niveau, LocalDateTime datePrediction,
        String modeleNom, String modeleVersion, Long alerteId, List<FacteurDto> facteurs
) {
    public static PredictionDto from(PredictionIA p, Long alerteId) {
        Etudiant e = p.getEtudiant();
        return new PredictionDto(p.getId(), e.getId(), e.getPrenom() + " " + e.getNom(), e.getMatricule(),
                p.getSemestre() != null ? p.getSemestre().getId() : null,
                p.getType(), p.getProbabilite(), p.getNiveau(), p.getDatePrediction(),
                p.getModeleIA().getNom(), p.getModeleIA().getVersion(), alerteId,
                p.getFacteurs().stream().map(FacteurDto::from).toList());
    }
}