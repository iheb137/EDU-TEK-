package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.repository.JournalAuditRepository;
import tn.tekup.edutek.service.AuditService;

import java.time.LocalDateTime;
import java.util.Map;

/** Purge du journal d'audit de l'etablissement : supprime les entrees plus anciennes que N jours. */
@RestController
@RequestMapping("/api/audit/purge")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class AuditPurgeController {

    public static final int MIN_JOURS = 30;

    private final JournalAuditRepository repository;
    private final AuditService audit;

    @PostMapping
    @Transactional
    public Map<String, Object> purger(@RequestParam(defaultValue = "365") int avantJours) {
        if (avantJours < MIN_JOURS) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Conservation minimale du journal : " + MIN_JOURS + " jours");
        }
        LocalDateTime limite = LocalDateTime.now().minusDays(avantJours);
        int supprimes = repository.supprimerAvant(limite);
        audit.log("AUDIT_PURGE", "JournalAudit", null, supprimes + " entree(s) anterieure(s) a " + limite);
        return Map.of("supprimes", supprimes, "avant", limite.toString());
    }
}