package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.DiffusionRequest;
import tn.tekup.edutek.dto.DiffusionResultDto;
import tn.tekup.edutek.service.DiffusionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Locale;

@RestController
@RequestMapping("/api/diffusions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_COMMUNICATION')")
public class DiffusionController {

    private final DiffusionService service;

    @PostMapping
    public DiffusionResultDto diffuser(@Valid @RequestBody DiffusionRequest req) {
        String audience = req.audience().trim().toUpperCase(Locale.ROOT);
        int n = service.diffuser(audience, req.classeId(), req.titre().trim(), req.contenu().trim());
        return new DiffusionResultDto(audience, n);
    }
}