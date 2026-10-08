package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AlerteTechniqueDto;
import tn.tekup.edutek.dto.AlerteTechniqueRequest;
import tn.tekup.edutek.dto.AnalyseResultDto;
import tn.tekup.edutek.dto.ExecutionDto;
import tn.tekup.edutek.dto.ExecutionRequest;
import tn.tekup.edutek.dto.IdsRequest;
import tn.tekup.edutek.dto.NotificationALivrerDto;
import tn.tekup.edutek.dto.PredictionDto;
import tn.tekup.edutek.entity.AlerteTechnique;
import tn.tekup.edutek.entity.ExecutionWorkflow;
import tn.tekup.edutek.entity.Notification;
import tn.tekup.edutek.entity.WorkflowN8n;
import tn.tekup.edutek.repository.NotificationLivraisonRepository;
import tn.tekup.edutek.repository.WorkflowN8nRepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.PredictionService;
import tn.tekup.edutek.service.TechniqueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/n8n")
@RequiredArgsConstructor
@PreAuthorize("hasRole('N8N')")
public class N8nController {

    private static final int LIMITE_MAX = 200;

    private final TechniqueService techniqueService;
    private final WorkflowN8nRepository workflowRepository;
    private final NotificationLivraisonRepository livraisonRepository;
    private final PredictionService predictionService;
    private final AuditService audit;

    @GetMapping("/sante")
    public Map<String, Object> sante() {
        return Map.of("statut", "ok", "heure", LocalDateTime.now().toString());
    }

    @PostMapping("/executions")
    @Transactional
    public ExecutionDto executions(@Valid @RequestBody ExecutionRequest req) {
        ExecutionWorkflow ex = techniqueService.enregistrerExecution(req.workflow().trim(), req.statut(),
                req.idExterne(), req.dureeMs(), req.resultat());
        return ExecutionDto.from(ex);
    }

    @PostMapping("/alertes-techniques")
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AlerteTechniqueDto alerte(@Valid @RequestBody AlerteTechniqueRequest req) {
        AlerteTechnique a = techniqueService.creerAlerte(req.type().trim(), req.niveau(), req.message().trim(),
                req.source(), null);
        return AlerteTechniqueDto.from(a);
    }

    @GetMapping("/workflows/{nom}/actif")
    @Transactional(readOnly = true)
    public Map<String, Object> actif(@PathVariable String nom) {
        WorkflowN8n wf = workflowRepository.findByNom(nom).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow inconnu : " + nom));
        return Map.of("workflow", wf.getNom(), "actif", Boolean.TRUE.equals(wf.getActif()));
    }

    // Pas de @Transactional : chaque etudiant est analyse dans sa propre transaction.
    @PostMapping("/analyses")
    public AnalyseResultDto analyses(@RequestParam Long semestreId,
                                     @RequestParam(required = false) Long etudiantId,
                                     @RequestParam(required = false) Long classeId) {
        List<Long> ids = predictionService.cibles(semestreId, etudiantId, classeId);
        List<PredictionDto> resultats = new ArrayList<>();
        List<String> avertissements = new ArrayList<>();
        int alertes = 0;
        for (Long id : ids) {
            try {
                PredictionService.Resultat r = predictionService.analyser(id, semestreId);
                resultats.add(r.prediction());
                if (r.alerteCreee()) {
                    alertes++;
                }
            } catch (ResponseStatusException e) {
                avertissements.add("Etudiant " + id + " : " + e.getReason());
            }
        }
        audit.log("ANALYSE_IA", "PredictionIA", null, "n8n - semestre " + semestreId + " : " + resultats.size()
                + " analyse(s), " + alertes + " alerte(s) creee(s), " + avertissements.size() + " avertissement(s)");
        return new AnalyseResultDto(semestreId, resultats.size(), alertes, resultats, avertissements);
    }

    @GetMapping("/notifications/a-envoyer")
    @Transactional(readOnly = true)
    public List<NotificationALivrerDto> aEnvoyer(@RequestParam(defaultValue = "50") int limite) {
        if (limite < 1 || limite > LIMITE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limite : entre 1 et " + LIMITE_MAX);
        }
        return livraisonRepository.findByEnvoyeLeIsNullOrderByDateEnvoiAscIdAsc(PageRequest.of(0, limite)).stream()
                .map(NotificationALivrerDto::from).toList();
    }

    @PostMapping("/notifications/envoyees")
    @Transactional
    public Map<String, Integer> envoyees(@Valid @RequestBody IdsRequest req) {
        LocalDateTime maintenant = LocalDateTime.now();
        int marquees = 0;
        for (Notification n : livraisonRepository.findAllById(req.ids())) {
            if (n.getEnvoyeLe() == null) {
                n.setEnvoyeLe(maintenant);
                marquees++;
            }
        }
        return Map.of("marquees", marquees);
    }

    /** A appeler une fois avant de brancher n8n : l'historique existant ne sera pas envoye. */
    @PostMapping("/notifications/amorcer")
    @Transactional
    public Map<String, Integer> amorcer() {
        return Map.of("marquees", livraisonRepository.amorcer(LocalDateTime.now()));
    }
}