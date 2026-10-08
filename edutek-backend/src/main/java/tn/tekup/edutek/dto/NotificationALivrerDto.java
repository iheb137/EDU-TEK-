package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Notification;

import java.time.LocalDateTime;

public record NotificationALivrerDto(Long id, String destinataireEmail, String destinataireNom,
                                     String titre, String contenu, LocalDateTime dateCreation) {
    public static NotificationALivrerDto from(Notification n) {
        return new NotificationALivrerDto(n.getId(), n.getDestinataire().getEmail(),
                n.getDestinataire().getPrenom() + " " + n.getDestinataire().getNom(),
                n.getTitre(), n.getContenu(), n.getDateEnvoi());
    }
}