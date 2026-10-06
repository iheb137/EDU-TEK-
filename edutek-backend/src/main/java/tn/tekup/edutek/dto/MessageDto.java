package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Message;

import java.time.LocalDateTime;

public record MessageDto(
        Long id,
        String objet,
        String contenu,
        LocalDateTime dateEnvoi,
        Boolean lu,
        Long expediteurId,
        String expediteurNom,
        Long destinataireId,
        String destinataireNom
) {
    public static MessageDto from(Message m) {
        return new MessageDto(m.getId(), m.getObjet(), m.getContenu(), m.getDateEnvoi(), m.getLu(),
                m.getExpediteur().getId(), m.getExpediteur().getPrenom() + " " + m.getExpediteur().getNom(),
                m.getDestinataire().getId(), m.getDestinataire().getPrenom() + " " + m.getDestinataire().getNom());
    }
}