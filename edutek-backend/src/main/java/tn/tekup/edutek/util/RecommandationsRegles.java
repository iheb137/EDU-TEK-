package tn.tekup.edutek.util;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * Recommandations destinees a l'etudiant, deduites des facteurs qui augmentent le risque.
 * Les textes ne mentionnent ni score, ni probabilite, ni risque, ni intelligence artificielle :
 * l'etudiant recoit des pistes d'action, pas un diagnostic.
 */
public final class RecommandationsRegles {

    public record Texte(String categorie, String texte) {}

    private static final int MAX_RECOMMANDATIONS = 4;

    private static final Texte ASSIDUITE = new Texte("ASSIDUITE",
            "Vos absences pèsent sur votre parcours ce semestre. Essayez d'assister à toutes les séances ; "
                    + "si une absence avait un motif valable, déposez un justificatif auprès du support administratif.");
    private static final Texte MATIERES = new Texte("MATIERES_A_RATTRAPER",
            "Certaines matières ne sont pas encore validées. Repérez-les avec vos enseignants et demandez "
                    + "un accompagnement (tutorat, séance de révision).");
    private static final Texte RESULTATS = new Texte("RESULTATS",
            "Votre moyenne du semestre est inférieure au seuil de validation. Rapprochez-vous de vos enseignants "
                    + "pour identifier les points à consolider avant les prochaines évaluations.");
    private static final Texte PROGRESSION = new Texte("PROGRESSION",
            "Vos résultats sont en baisse par rapport au semestre précédent. Faites le point avec votre responsable pédagogique.");
    private static final Texte SUIVI = new Texte("SUIVI",
            "Un entretien avec votre responsable pédagogique pourrait vous aider à faire le point sur votre semestre.");

    private RecommandationsRegles() {}

    /**
     * @param facteursAggravants noms des facteurs dont la contribution est positive, du plus important au moins important
     * @return au plus 4 recommandations, sans doublon de categorie ; une recommandation generale si aucun facteur n'est reconnu
     */
    public static List<Texte> generer(List<String> facteursAggravants) {
        Map<String, Texte> parCategorie = new LinkedHashMap<>();
        if (facteursAggravants != null) {
            for (String nom : facteursAggravants) {
                Texte t = pourFacteur(nom);
                if (t != null) {
                    parCategorie.putIfAbsent(t.categorie(), t);
                }
                if (parCategorie.size() >= MAX_RECOMMANDATIONS) {
                    break;
                }
            }
        }
        if (parCategorie.isEmpty()) {
            parCategorie.put(SUIVI.categorie(), SUIVI);
        }
        return new ArrayList<>(parCategorie.values());
    }

    private static Texte pourFacteur(String nom) {
        if (nom == null) {
            return null;
        }
        return switch (nom) {
            case "TAUX_ABSENCE", "TAUX_ABSENCE_NON_JUSTIFIEE" -> ASSIDUITE;
            case "NB_MATIERES_NON_VALIDEES" -> MATIERES;
            case "MOYENNE_SEMESTRE" -> RESULTATS;
            case "TENDANCE_MOYENNE" -> PROGRESSION;
            default -> null;
        };
    }
}