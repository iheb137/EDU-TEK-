package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.JustificatifAbsence;

import java.time.LocalDate;
import java.time.LocalDateTime;

public record JustificatifDto(
        Long id, Long etudiantId, String etudiantNom, String etudiantMatricule,
        LocalDate dateDebut, LocalDate dateFin, String motif, String commentaire, String pieceUrl,
        String statut, String motifRejet, LocalDateTime dateSoumission, LocalDateTime dateDecision,
        Long traiteParId, Integer nbAbsencesJustifiees
) {
    public static JustificatifDto from(JustificatifAbsence j) {
        Etudiant e = j.getEtudiant();
        return new JustificatifDto(j.getId(), e.getId(), e.getPrenom() + " " + e.getNom(), e.getMatricule(),
                j.getDateDebut(), j.getDateFin(), j.getMotif(), j.getCommentaire(), j.getPieceUrl(),
                j.getStatut(), j.getMotifRejet(), j.getDateSoumission(), j.getDateDecision(),
                j.getTraitePar() != null ? j.getTraitePar().getId() : null, j.getNbAbsencesJustifiees());
    }
}