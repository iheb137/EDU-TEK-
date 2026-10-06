package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Administrateur;
import tn.tekup.edutek.entity.Role;

import java.util.List;

public record AdminResponse(
        Long id, String nom, String prenom, String email, String telephone,
        Boolean actif, List<String> roles
) {
    public static AdminResponse from(Administrateur a) {
        return new AdminResponse(a.getId(), a.getNom(), a.getPrenom(), a.getEmail(), a.getTelephone(),
                a.getActif(), a.getRoles().stream().map(Role::getNom).toList());
    }
}