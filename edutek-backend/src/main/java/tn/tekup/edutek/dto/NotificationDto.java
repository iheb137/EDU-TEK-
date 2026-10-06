package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Notification;

import java.time.LocalDateTime;

public record NotificationDto(
        Long id,
        String titre,
        String contenu,
        LocalDateTime dateEnvoi,
        Boolean lue
) {
    public static NotificationDto from(Notification n) {
        return new NotificationDto(n.getId(), n.getTitre(), n.getContenu(), n.getDateEnvoi(), n.getLue());
    }
}