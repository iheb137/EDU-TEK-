package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.ModeleIA;

public record ModeleIaDto(Long id, String nom, String version, String type, String statut) {
    public static ModeleIaDto from(ModeleIA m) {
        return new ModeleIaDto(m.getId(), m.getNom(), m.getVersion(), m.getType(), m.getStatut());
    }
}