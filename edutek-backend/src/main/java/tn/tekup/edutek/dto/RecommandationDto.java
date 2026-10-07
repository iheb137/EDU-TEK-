package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Recommandation;

import java.time.LocalDateTime;

public record RecommandationDto(Long id, Long semestreId, String categorie, String texte,
                                LocalDateTime dateCreation, boolean lue) {
    public static RecommandationDto from(Recommandation r) {
        return new RecommandationDto(r.getId(), r.getSemestre() != null ? r.getSemestre().getId() : null,
                r.getCategorie(), r.getTexte(), r.getDateCreation(), Boolean.TRUE.equals(r.getLue()));
    }
}