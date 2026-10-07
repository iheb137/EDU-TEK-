package tn.tekup.edutek.dto;

import java.time.LocalDateTime;
import java.util.List;

public record TableauDeBordDto(
        Long semestreId,
        Long classeId,
        int nbEtudiantsAnalyses,
        Repartition repartition,
        Double probabiliteMoyenne,
        AlertesParStatut alertes,
        ActionsParStatut actions,
        Feedbacks feedbacks,
        List<FacteurFrequent> facteursPrincipaux,
        List<ClasseResume> parClasse,
        LocalDateTime derniereAnalyse
) {
    public record Repartition(int faible, int moyen, int eleve) {}

    public record AlertesParStatut(int ouvertes, int enCours, int traitees, int classees) {}

    public record ActionsParStatut(int planifiees, int enCours, int terminees, int annulees) {}

    public record Feedbacks(int total, int pertinents) {}

    public record FacteurFrequent(String nom, int occurrences) {}

    public record ClasseResume(Long classeId, String classeNom, int nbEtudiantsAnalyses, int nbEleve, int nbMoyen,
                               Double probabiliteMoyenne) {}
}