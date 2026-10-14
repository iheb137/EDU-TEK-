package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.SupportEnseignement;

import java.time.LocalDateTime;

public record SupportEnseignementDto(
        Long id,
        Long enseignementId,
        String titre,
        String chapitre,
        String nature,
        String url,
        String nomFichier,
        String typeMime,
        Long tailleOctets,
        boolean visible,
        LocalDateTime dateDepot,
        String deposePar
) {
    public static SupportEnseignementDto from(SupportEnseignement s) {
        return new SupportEnseignementDto(s.getId(), s.getEnseignement().getId(), s.getTitre(), s.getChapitre(),
                s.getNature(), s.getUrl(), s.getNomFichier(), s.getTypeMime(), s.getTailleOctets(),
                Boolean.TRUE.equals(s.getVisible()), s.getDateDepot(), s.getDeposePar());
    }
}
