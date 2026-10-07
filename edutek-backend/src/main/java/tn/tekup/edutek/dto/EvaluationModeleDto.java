package tn.tekup.edutek.dto;

public record EvaluationModeleDto(
        ModeleIaDto modele,
        int nbEtudiants,
        int exclus,
        boolean echantillonSuffisant,
        int positifsReels,
        int vp, int fp, int vn, int fn,
        Double precision, Double rappel, Double f1, Double exactitude, Double brier, Double auc
) {}