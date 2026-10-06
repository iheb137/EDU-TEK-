package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.SupportCours;

import java.time.LocalDateTime;

public record SupportCoursDto(Long id, String titre, String type, String url, LocalDateTime dateDepot,
                              Long classeVirtuelleId) {
    public static SupportCoursDto from(SupportCours s) {
        return new SupportCoursDto(s.getId(), s.getTitre(), s.getType(), s.getUrl(), s.getDateDepot(),
                s.getClasseVirtuelle().getId());
    }
}