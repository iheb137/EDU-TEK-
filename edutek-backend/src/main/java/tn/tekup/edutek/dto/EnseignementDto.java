package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Enseignement;
import jakarta.validation.constraints.NotNull;

public record EnseignementDto(
        Long id,
        String groupe,
        Integer volumeHoraire,
        @NotNull Long enseignantId,
        @NotNull Long matiereId,
        @NotNull Long classeId,
        @NotNull Long semestreId
) {
    public static EnseignementDto from(Enseignement e) {
        return new EnseignementDto(e.getId(), e.getGroupe(), e.getVolumeHoraire(),
                e.getEnseignant().getId(), e.getMatiere().getId(),
                e.getClasse().getId(), e.getSemestre().getId());
    }
}