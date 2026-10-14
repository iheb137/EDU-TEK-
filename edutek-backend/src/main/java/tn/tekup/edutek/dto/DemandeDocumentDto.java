package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.AdminSupport;
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
        String traiteParNom,
        String messageRetrait,
        LocalDateTime datePret,
        LocalDateTime dateRemise,
        String remisParNom
) {
    public static DemandeDocumentDto from(DemandeDocument d) {
        Etudiant e = d.getEtudiant();
        return new DemandeDocumentDto(d.getId(), d.getTypeDocument(), d.getDateDemande(), d.getStatut(),
                d.getMotifRejet(), e.getId(), e.getPrenom() + " " + e.getNom(), e.getMatricule(),
                d.getTraitePar() != null ? d.getTraitePar().getId() : null,
                nom(d.getTraitePar()), d.getMessageRetrait(), d.getDatePret(), d.getDateRemise(), nom(d.getRemisPar()));
    }

    private static String nom(AdminSupport a) {
        return a == null ? null : a.getPrenom() + " " + a.getNom();
    }
}
