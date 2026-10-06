package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Etudiant;

public record EtudiantResponse(
        Long id, String nom, String prenom, String email, String telephone,
        Boolean actif, String matricule, String niveau, Long classeId
) {
    public static EtudiantResponse from(Etudiant e) {
        return new EtudiantResponse(e.getId(), e.getNom(), e.getPrenom(), e.getEmail(), e.getTelephone(),
                e.getActif(), e.getMatricule(), e.getNiveau(),
                e.getClasse() != null ? e.getClasse().getId() : null);
    }
}