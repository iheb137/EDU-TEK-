package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AuditDto;
import tn.tekup.edutek.dto.PageDto;
import tn.tekup.edutek.entity.JournalAudit;
import tn.tekup.edutek.repository.JournalAuditRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.server.ResponseStatusException;

import java.util.Locale;

@RestController
@RequestMapping("/api/audit")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class AuditController {

    private final JournalAuditRepository repository;

    @GetMapping
    @Transactional(readOnly = true)
    public PageDto<AuditDto> lister(@RequestParam(defaultValue = "") String acteur,
                                    @RequestParam(defaultValue = "") String action,
                                    @RequestParam(defaultValue = "0") int page,
                                    @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100 || acteur.length() > 100 || action.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "page >= 0, 1 <= size <= 100, filtres limites a 100 caracteres");
        }
        Page<JournalAudit> p = repository.rechercher(acteur.trim(), action.trim().toUpperCase(Locale.ROOT),
                PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "horodatage")));
        return new PageDto<>(p.getContent().stream().map(AuditDto::from).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }
}