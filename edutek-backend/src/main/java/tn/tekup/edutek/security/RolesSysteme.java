package tn.tekup.edutek.security;

import java.util.List;

public final class RolesSysteme {
    public static final List<String> NOMS = List.of(
            "SUPERADMIN", "ADMIN_PEDAGOGIQUE", "ADMIN_COMMUNICATION",
            "ADMIN_SUPPORT", "ADMIN_FINANCIER", "ENSEIGNANT", "ETUDIANT");

    private RolesSysteme() {}
}