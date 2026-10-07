package tn.tekup.edutek.util;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;

/**
 * Modele a regles ECRIT A LA MAIN, utilise comme substitut du service d'IA tant que le modele
 * de Deep Learning n'existe pas. Ce n'est PAS un modele entraine : ses coefficients sont fixes.
 * Regression logistique a coefficients fixes sur les indicateurs academiques.
 */
public final class ModeleRegles {

    public static final String NOM = "stub-regles";
    public static final String VERSION = "1";
    public static final String TYPE = "BASELINE_REGLES";

    private static final double ORDONNEE = -0.5;

    public record Facteur(String nom, double valeur, double contribution) {}

    public record Resultat(double probabilite, List<Facteur> facteurs) {}

    private ModeleRegles() {}

    public static Resultat evaluer(Map<String, Double> indicateurs) {
        double moyenne = borne(valeur(indicateurs, "MOYENNE_SEMESTRE", 10.0), 0.0, 20.0);
        double absence = borne(valeur(indicateurs, "TAUX_ABSENCE", 0.0), 0.0, 1.0);
        double absenceNonJustifiee = borne(valeur(indicateurs, "TAUX_ABSENCE_NON_JUSTIFIEE", 0.0), 0.0, 1.0);
        double nonValidees = borne(valeur(indicateurs, "NB_MATIERES_NON_VALIDEES", 0.0), 0.0, 50.0);
        double tendance = borne(valeur(indicateurs, "TENDANCE_MOYENNE", 0.0), -20.0, 20.0);

        List<Facteur> facteurs = new ArrayList<>();
        facteurs.add(new Facteur("TAUX_ABSENCE", absence, 3.0 * absence));
        facteurs.add(new Facteur("TAUX_ABSENCE_NON_JUSTIFIEE", absenceNonJustifiee, 2.0 * absenceNonJustifiee));
        facteurs.add(new Facteur("NB_MATIERES_NON_VALIDEES", nonValidees, 0.4 * nonValidees));
        facteurs.add(new Facteur("MOYENNE_SEMESTRE", moyenne, -0.25 * (moyenne - 10.0)));
        facteurs.add(new Facteur("TENDANCE_MOYENNE", tendance, -0.15 * tendance));

        double z = ORDONNEE;
        for (Facteur f : facteurs) {
            z += f.contribution();
        }
        double probabilite = arrondi(1.0 / (1.0 + Math.exp(-z)));

        List<Facteur> retenus = facteurs.stream()
                .filter(f -> Math.abs(f.contribution()) > 1e-9)
                .sorted(Comparator.comparingDouble((Facteur f) -> Math.abs(f.contribution())).reversed())
                .map(f -> new Facteur(f.nom(), arrondi(f.valeur()), arrondi(f.contribution())))
                .toList();
        return new Resultat(probabilite, retenus);
    }

    private static double valeur(Map<String, Double> m, String cle, double defaut) {
        if (m == null) {
            return defaut;
        }
        Double v = m.get(cle);
        return v == null || v.isNaN() || v.isInfinite() ? defaut : v;
    }

    private static double borne(double v, double min, double max) {
        return Math.max(min, Math.min(max, v));
    }

    private static double arrondi(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}