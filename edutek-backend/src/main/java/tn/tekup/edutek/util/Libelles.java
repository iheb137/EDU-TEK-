package tn.tekup.edutek.util;

import java.util.Locale;
import java.util.Map;

public final class Libelles {

    private static final Map<String, String> TAGS = Map.ofEntries(
            Map.entry("Auth", "Authentification"),
            Map.entry("Formation", "Formations"),
            Map.entry("Semestre", "Semestres"),
            Map.entry("Classe", "Classes"),
            Map.entry("Matiere", "Matières"),
            Map.entry("Etudiant", "Étudiants"),
            Map.entry("Enseignant", "Enseignants"),
            Map.entry("Admin", "Administrateurs"),
            Map.entry("Enseignement", "Enseignements"),
            Map.entry("Inscription", "Inscriptions"),
            Map.entry("Evaluation", "Évaluations"),
            Map.entry("Note", "Notes"),
            Map.entry("Seance", "Séances"),
            Map.entry("Presence", "Présences"),
            Map.entry("Resultat", "Résultats de semestre"),
            Map.entry("Indicateur", "Indicateurs académiques"),
            Map.entry("Message", "Messagerie"),
            Map.entry("Notification", "Notifications"),
            Map.entry("Annuaire", "Annuaire"),
            Map.entry("DemandeDocument", "Demandes de documents"),
            Map.entry("Stage", "Stages"),
            Map.entry("Role", "Rôles"),
            Map.entry("Permission", "Permissions"),
            Map.entry("UtilisateurAdmin", "Comptes utilisateurs"),
            Map.entry("Audit", "Journal d'audit"),
            Map.entry("ImportComptes", "Import de comptes"),
            Map.entry("ClasseVirtuelle", "Classes virtuelles"),
            Map.entry("Actualite", "Actualités"),
            Map.entry("Diffusion", "Diffusions"),
            Map.entry("Pointage", "Pointages"),
            Map.entry("Tarif", "Tarifs"),
            Map.entry("Paiement", "Paiements"),
            Map.entry("Justificatif", "Justificatifs d'absence"));

    private Libelles() {}

    /** "validerPeriode" -> "Valider periode" ; retire le suffixe "_1" des operationId en doublon. */
    public static String humaniser(String identifiant) {
        if (identifiant == null || identifiant.isBlank()) {
            return "";
        }
        String s = identifiant.replaceAll("_\\d+$", "");
        String mots = s.replaceAll("([a-z0-9])([A-Z])", "$1 $2").toLowerCase(Locale.ROOT);
        return Character.toUpperCase(mots.charAt(0)) + mots.substring(1);
    }

    /** "PointageController" -> "Pointages". */
    public static String tag(String nomControleur) {
        String s = nomControleur == null ? "" : nomControleur.replaceAll("Controller$", "");
        return TAGS.getOrDefault(s, humaniser(s));
    }
}