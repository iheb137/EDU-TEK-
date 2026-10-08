package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ResultatSemestre;

public record ResultatSemestreDto(
        Long id,
        Long etudiantId,
        Long semestreId,
        Double moyenne,
        String decision,
        Integer creditsObtenus,
        Integer rangClasse,
        Integer effectifClasse,
        Integer rangFiliere,
        Integer effectifFiliere,
        String statut
) {
    public static ResultatSemestreDto from(ResultatSemestre r) {
        return new ResultatSemestreDto(r.getId(), r.getEtudiant().getId(), r.getSemestre().getId(),
                r.getMoyenne(), r.getDecision(), r.getCreditsObtenus(),
                r.getRangClasse(), r.getEffectifClasse(), r.getRangFiliere(), r.getEffectifFiliere(),
                r.getStatut() != null ? r.getStatut() : "CALCULE");
    }
}