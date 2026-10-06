package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Actualite;

import java.time.LocalDateTime;

public record ActualiteDto(Long id, String titre, String contenu, LocalDateTime datePublication,
                           String lienDocument, Long auteurId, String auteurNom) {
    public static ActualiteDto from(Actualite a) {
        return new ActualiteDto(a.getId(), a.getTitre(), a.getContenu(), a.getDatePublication(), a.getLienDocument(),
                a.getAuteur().getId(), a.getAuteur().getPrenom() + " " + a.getAuteur().getNom());
    }
}