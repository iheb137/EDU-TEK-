package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Pointage;
import tn.tekup.edutek.entity.Seance;
import tn.tekup.edutek.util.PaiementCalcul;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;

public record PointageDto(
        Long id, Long seanceId, LocalDate date, LocalTime heureDebut, LocalTime heureFin,
        String matiereNom, String classeNom, Long enseignantId, String enseignantNom,
        int minutesPlanifiees, Integer minutesDeclarees, Integer minutesValidees,
        String statut, String commentaire, String commentaireFinance,
        LocalDateTime datePointage, LocalDateTime dateValidation
) {
    public static PointageDto from(Pointage p) {
        Seance s = p.getSeance();
        Enseignement e = s.getEnseignement();
        return new PointageDto(p.getId(), s.getId(), s.getDate(), s.getHeureDebut(), s.getHeureFin(),
                e.getMatiere().getNom(), e.getClasse().getNom(), e.getEnseignant().getId(),
                e.getEnseignant().getPrenom() + " " + e.getEnseignant().getNom(),
                PaiementCalcul.minutes(s.getHeureDebut(), s.getHeureFin()),
                p.getMinutesDeclarees(), p.getMinutesValidees(), p.getStatut(),
                p.getCommentaire(), p.getCommentaireFinance(), p.getDatePointage(), p.getDateValidation());
    }
}