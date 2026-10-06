package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ClasseVirtuelle;
import tn.tekup.edutek.entity.Enseignement;

import java.time.LocalDateTime;

public record ClasseVirtuelleDto(
        Long id,
        String plateforme,
        String lien,
        String codeAcces,
        LocalDateTime dateHeure,
        Long enseignementId,
        Long classeId,
        String classeNom,
        String matiereNom,
        String enseignantNom
) {
    public static ClasseVirtuelleDto from(ClasseVirtuelle c) {
        Enseignement e = c.getEnseignement();
        return new ClasseVirtuelleDto(c.getId(), c.getPlateforme(), c.getLien(), c.getCodeAcces(), c.getDateHeure(),
                e.getId(), e.getClasse().getId(), e.getClasse().getNom(), e.getMatiere().getNom(),
                e.getEnseignant().getPrenom() + " " + e.getEnseignant().getNom());
    }
}