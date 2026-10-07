package tn.tekup.edutek.util;

/**
 * Metriques de classification binaire pour comparer des modeles de risque.
 * Classe positive = l'evenement a predire (ici : semestre non valide, decision AJOURNE).
 * Une prediction est positive si probabilite >= seuil.
 */
public final class MetriquesClassification {

    public record Resultat(int n, int positifsReels, int vp, int fp, int vn, int fn,
                           Double precision, Double rappel, Double f1, Double exactitude,
                           Double brier, Double auc) {}

    private MetriquesClassification() {}

    public static Resultat calculer(double[] probabilites, boolean[] reels, double seuil) {
        if (probabilites.length != reels.length) {
            throw new IllegalArgumentException("probabilites et reels doivent avoir la meme longueur");
        }
        int n = probabilites.length;
        int vp = 0, fp = 0, vn = 0, fn = 0;
        double somme = 0;
        for (int i = 0; i < n; i++) {
            boolean predit = probabilites[i] >= seuil;
            if (predit && reels[i]) vp++;
            else if (predit) fp++;
            else if (reels[i]) fn++;
            else vn++;
            double ecart = probabilites[i] - (reels[i] ? 1.0 : 0.0);
            somme += ecart * ecart;
        }
        int positifs = vp + fn;
        int negatifs = vn + fp;

        Double precision = (vp + fp) > 0 ? arrondi((double) vp / (vp + fp)) : null;
        Double rappel = positifs > 0 ? arrondi((double) vp / positifs) : null;
        Double f1 = null;
        if (precision != null && rappel != null && (precision + rappel) > 0) {
            double p = (double) vp / (vp + fp);
            double r = (double) vp / positifs;
            f1 = arrondi(2 * p * r / (p + r));
        }
        Double exactitude = n > 0 ? arrondi((double) (vp + vn) / n) : null;
        Double brier = n > 0 ? arrondi(somme / n) : null;
        Double auc = (positifs > 0 && negatifs > 0) ? arrondi(auc(probabilites, reels, positifs, negatifs)) : null;
        return new Resultat(n, positifs, vp, fp, vn, fn, precision, rappel, f1, exactitude, brier, auc);
    }

    /** Aire sous la courbe ROC (Mann-Whitney) : probabilite qu'un positif ait un score superieur a un negatif, egalites comptees 1/2. */
    private static double auc(double[] p, boolean[] reels, int positifs, int negatifs) {
        double total = 0;
        for (int i = 0; i < p.length; i++) {
            if (!reels[i]) continue;
            for (int j = 0; j < p.length; j++) {
                if (reels[j]) continue;
                if (p[i] > p[j]) total += 1.0;
                else if (p[i] == p[j]) total += 0.5;
            }
        }
        return total / ((double) positifs * negatifs);
    }

    private static double arrondi(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}