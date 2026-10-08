package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.service.StatistiquesService;

/** Statistiques de notes (evaluation) et de resultats (semestre, classes, filiere). */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
public class StatistiquesController {

    private final StatistiquesService service;
    private final SemestreRepository semestreRepository;

    @GetMapping("/evaluations/{id}/statistiques")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
    public StatistiquesService.EvaluationStatistiques evaluation(@PathVariable Long id,
                                                                 @RequestParam(defaultValue = "false") boolean inclureBrouillons,
                                                                 Authentication auth) {
        return service.evaluation(id, inclureBrouillons, auth);
    }

    @GetMapping("/resultats/semestres/{semestreId}/statistiques")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public StatistiquesService.SemestreStatistiques semestre(@PathVariable Long semestreId) {
        return service.semestre(semestreRepository.findById(semestreId).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + semestreId)));
    }
}