package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.dto.ResultatSemestreDto;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.SemestreRepository;
import tn.tekup.edutek.service.ResultatPublicationService;

import java.util.List;
import java.util.Map;

/** Calcul officiel, suivi d'avancement et publication des resultats d'un semestre. */
@RestController
@RequestMapping("/api/resultats/semestres/{semestreId}")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
public class PublicationResultatsController {

    private final SemestreRepository semestreRepository;
    private final ResultatPublicationService service;

    @GetMapping("/avancement")
    public List<ResultatPublicationService.LigneAvancement> avancement(@PathVariable Long semestreId) {
        return service.avancement(semestre(semestreId).getId());
    }

    @PostMapping("/calcul")
    @Transactional
    public List<ResultatSemestreDto> calculer(@PathVariable Long semestreId) {
        return service.calculer(semestre(semestreId));
    }

    @PostMapping("/publication")
    @Transactional
    public Map<String, Object> publier(@PathVariable Long semestreId) {
        return Map.of("publies", service.publier(semestre(semestreId)));
    }

    private Semestre semestre(Long id) {
        return semestreRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + id));
    }
}