package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.DemandeDocument;
import tn.tekup.edutek.entity.Etudiant;

import java.time.LocalDateTime;

public record DemandeDocumentDto(
        Long id,
        String typeDocument,
        LocalDateTime dateDemande,
        String statut,
        String motifRejet,
        Long etudiantId,
        String etudiantNom,
        String etudiantMatricule,
        Long traiteParId,
        boolean documentDisponible
) {
    public static DemandeDocumentDto from(DemandeDocument d) {
        Etudiant e = d.getEtudiant();
        return new DemandeDocumentDto(d.getId(), d.getTypeDocument(), d.getDateDemande(), d.getStatut(),
                d.getMotifRejet(), e.getId(), e.getPrenom() + " " + e.getNom(), e.getMatricule(),
                d.getTraitePar() != null ? d.getTraitePar().getId() : null,
                d.getDocumentGenere() != null);
    }
}