package tn.tekup.edutek.ia;

import java.time.LocalDate;
import java.util.List;
import java.util.Map;

/** Messages echanges avec le service d'IA (voir docs/contrat-service-ia.md). */
public final class ContratIa {

    private ContratIa() {}

    public record ModeleInfo(String nom, String version, String type) {}

    public record PeriodeIndicateurs(Long semestreId, LocalDate dateDebut, Map<String, Double> indicateurs) {}

    public record DemandePrediction(Long etudiantId, Long semestreId, Map<String, Double> indicateurs,
                                    List<PeriodeIndicateurs> historique) {}

    public record FacteurIa(String nom, Double valeur, Double contribution) {}

    public record ReponsePrediction(ModeleInfo modele, double probabilite, List<FacteurIa> facteurs) {}
}