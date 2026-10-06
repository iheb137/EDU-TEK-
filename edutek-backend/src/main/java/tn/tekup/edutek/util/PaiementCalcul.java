package tn.tekup.edutek.util;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

public final class PaiementCalcul {

    public record Candidat(Long id, String grade, LocalDate dateDebut, BigDecimal montant) {}

    private PaiementCalcul() {}

    /**
     * Tarif applicable a une date pour un grade : le tarif specifique au grade le plus recent
     * (date d'effet <= date) l'emporte ; a defaut, le tarif general (sans grade) le plus recent.
     */
    public static Optional<Candidat> resoudreTarif(List<Candidat> candidats, String grade, LocalDate date) {
        String g = normaliser(grade);
        Candidat specifique = null;
        Candidat general = null;
        for (Candidat c : candidats) {
            if (c.dateDebut() == null || c.dateDebut().isAfter(date)) {
                continue;
            }
            String cg = normaliser(c.grade());
            if (cg == null) {
                if (general == null || c.dateDebut().isAfter(general.dateDebut())) {
                    general = c;
                }
            } else if (g != null && cg.equals(g)) {
                if (specifique == null || c.dateDebut().isAfter(specifique.dateDebut())) {
                    specifique = c;
                }
            }
        }
        return Optional.ofNullable(specifique != null ? specifique : general);
    }

    public static String normaliser(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim().toLowerCase(Locale.ROOT);
        return t.isEmpty() ? null : t;
    }

    /** minutes x tarif horaire / 60, arrondi a 3 decimales (millimes), demi vers le haut. */
    public static BigDecimal montantLigne(int minutes, BigDecimal tarifHoraire) {
        return tarifHoraire.multiply(BigDecimal.valueOf(minutes))
                .divide(BigDecimal.valueOf(60), 3, RoundingMode.HALF_UP);
    }

    public static int minutes(LocalTime debut, LocalTime fin) {
        return (int) Duration.between(debut, fin).toMinutes();
    }
}