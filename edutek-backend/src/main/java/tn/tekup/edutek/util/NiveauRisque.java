package tn.tekup.edutek.util;

public final class NiveauRisque {

    private NiveauRisque() {}

    /** FAIBLE, MOYEN ou ELEVE selon les seuils (seuil atteint = niveau atteint). */
    public static String depuis(double probabilite, double seuilMoyen, double seuilEleve) {
        if (probabilite >= seuilEleve) {
            return "ELEVE";
        }
        if (probabilite >= seuilMoyen) {
            return "MOYEN";
        }
        return "FAIBLE";
    }
}