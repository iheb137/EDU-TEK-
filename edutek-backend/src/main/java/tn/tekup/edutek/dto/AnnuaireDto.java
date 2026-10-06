package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.Utilisateur;

import java.util.List;

public record AnnuaireDto(Long id, String nom, String prenom, List<String> roles) {
    public static AnnuaireDto from(Utilisateur u) {
        return new AnnuaireDto(u.getId(), u.getNom(), u.getPrenom(),
                u.getRoles().stream().map(Role::getNom).toList());
    }
}