package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.*;

import java.time.LocalDateTime;
import java.util.List;

public record UtilisateurAdminDto(
        Long id, String nom, String prenom, String email, String telephone,
        Boolean actif, boolean mdpTemporaire, String type, List<String> roles, LocalDateTime dateCreation
) {
    public static UtilisateurAdminDto from(Utilisateur u) {
        return new UtilisateurAdminDto(u.getId(), u.getNom(), u.getPrenom(), u.getEmail(), u.getTelephone(),
                u.getActif(), Boolean.TRUE.equals(u.getMdpTemporaire()), typeDe(u),
                u.getRoles().stream().map(Role::getNom).sorted().toList(), u.getDateCreation());
    }

    public static String typeDe(Utilisateur u) {
        if (u instanceof Etudiant) return "ETUDIANT";
        if (u instanceof Enseignant) return "ENSEIGNANT";
        if (u instanceof SuperAdmin) return "SUPERADMIN";
        if (u instanceof AdminPedagogique) return "ADMIN_PEDAGOGIQUE";
        if (u instanceof AdminCommunication) return "ADMIN_COMMUNICATION";
        if (u instanceof AdminSupport) return "ADMIN_SUPPORT";
        if (u instanceof AdminFinancier) return "ADMIN_FINANCIER";
        return "INCONNU";
    }
}