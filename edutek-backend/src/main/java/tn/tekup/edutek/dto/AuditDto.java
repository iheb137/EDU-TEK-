package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.JournalAudit;

import java.time.LocalDateTime;

public record AuditDto(Long id, LocalDateTime horodatage, String acteurEmail, String action,
                       String entite, Long entiteId, String details, String adresseIp) {
    public static AuditDto from(JournalAudit j) {
        return new AuditDto(j.getId(), j.getHorodatage(), j.getActeurEmail(), j.getAction(),
                j.getEntite(), j.getEntiteId(), j.getDetails(), j.getAdresseIp());
    }
}