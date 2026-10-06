package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Enseignant;

public record EnseignantResponse(
        Long id, String nom, String prenom, String email, String telephone,
        Boolean actif, String matricule, String specialite, String grade
) {
    public static EnseignantResponse from(Enseignant e) {
        return new EnseignantResponse(e.getId(), e.getNom(), e.getPrenom(), e.getEmail(), e.getTelephone(),
                e.getActif(), e.getMatricule(), e.getSpecialite(), e.getGrade());
    }
}