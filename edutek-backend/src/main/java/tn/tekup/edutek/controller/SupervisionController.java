package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ActifRequest;
import tn.tekup.edutek.dto.AlerteTechniqueDto;
import tn.tekup.edutek.dto.ExecutionDto;
import tn.tekup.edutek.dto.StatutRequest;
import tn.tekup.edutek.dto.WorkflowDto;
import tn.tekup.edutek.entity.AlerteTechnique;
import tn.tekup.edutek.entity.ExecutionWorkflow;
import tn.tekup.edutek.entity.SuperAdmin;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.entity.WorkflowN8n;
import tn.tekup.edutek.repository.AlerteTechniqueRepository;
import tn.tekup.edutek.repository.ExecutionWorkflowRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.repository.WorkflowN8nRepository;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.TechniqueService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@RestController
@RequestMapping("/api/supervision")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class SupervisionController {

    private static final int LIMITE_MAX = 200;
    private static final List<String> STATUTS_ALERTE = List.of("OUVERTE", "ACQUITTEE", "RESOLUE");
    private static final Map<String, Set<String>> TRANSITIONS = Map.of(
            "OUVERTE", Set.of("ACQUITTEE", "RESOLUE"),
            "ACQUITTEE", Set.of("RESOLUE"));

    private final WorkflowN8nRepository workflowRepository;
    private final ExecutionWorkflowRepository executionRepository;
    private final AlerteTechniqueRepository alerteRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final AuditService audit;

    @GetMapping("/workflows")
    @Transactional(readOnly = true)
    public List<WorkflowDto> workflows() {
        return workflowRepository.findAllByOrderByNomAsc().stream().map(this::versDto).toList();
    }

    @PatchMapping("/workflows/{id}/actif")
    @Transactional
    public WorkflowDto actif(@PathVariable Long id, @Valid @RequestBody ActifRequest req, Authentication auth) {
        WorkflowN8n wf = workflowRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Workflow introuvable : " + id));
        wf.setActif(req.actif());
        wf.setConfigurePar(superAdmin(auth));
        audit.log("WORKFLOW_ACTIF", "WorkflowN8n", wf.getId(), wf.getNom() + " : " + req.actif());
        return versDto(wf);
    }

    @GetMapping("/executions")
    @Transactional(readOnly = true)
    public List<ExecutionDto> executions(@RequestParam(required = false) Long workflowId,
                                         @RequestParam(required = false) String statut,
                                         @RequestParam(defaultValue = "50") int limite) {
        if (limite < 1 || limite > LIMITE_MAX) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "limite : entre 1 et " + LIMITE_MAX);
        }
        String s = normaliser(statut, TechniqueService.STATUTS_EXECUTION, "Statut");
        List<ExecutionWorkflow> base = workflowId != null
                ? executionRepository.findByWorkflowIdOrderByDateExecutionDescIdDesc(workflowId)
                : executionRepository.findAllByOrderByDateExecutionDescIdDesc(PageRequest.of(0, LIMITE_MAX));
        return base.stream()
                .filter(e -> s == null || s.equals(e.getStatut()))
                .limit(limite)
                .map(ExecutionDto::from).toList();
    }

    @GetMapping("/alertes-techniques")
    @Transactional(readOnly = true)
    public List<AlerteTechniqueDto> alertes(@RequestParam(required = false) String statut,
                                            @RequestParam(required = false) String niveau) {
        String s = normaliser(statut, STATUTS_ALERTE, "Statut");
        String n = normaliser(niveau, TechniqueService.NIVEAUX, "Niveau");
        return alerteRepository.findAllByOrderByDateCreationDescIdDesc().stream()
                .filter(a -> s == null || s.equals(a.getStatut()))
                .filter(a -> n == null || n.equals(a.getNiveau()))
                .map(AlerteTechniqueDto::from).toList();
    }

    @PatchMapping("/alertes-techniques/{id}/statut")
    @Transactional
    public AlerteTechniqueDto changerStatut(@PathVariable Long id, @Valid @RequestBody StatutRequest req,
                                            Authentication auth) {
        AlerteTechnique a = alerteRepository.findByIdForUpdate(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Alerte technique introuvable : " + id));
        String nouveau = normaliser(req.statut(), STATUTS_ALERTE, "Statut");
        if (nouveau.equals(a.getStatut())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "L'alerte est deja au statut " + nouveau);
        }
        if (!TRANSITIONS.getOrDefault(a.getStatut(), Set.of()).contains(nouveau)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    "Transition impossible : " + a.getStatut() + " vers " + nouveau);
        }
        a.setStatut(nouveau);
        a.setSupervisePar(superAdmin(auth));
        a.setDateTraitement(LocalDateTime.now());
        return AlerteTechniqueDto.from(a);
    }

    private WorkflowDto versDto(WorkflowN8n wf) {
        ExecutionWorkflow derniere = executionRepository.findFirstByWorkflowIdOrderByDateExecutionDescIdDesc(wf.getId()).orElse(null);
        return new WorkflowDto(wf.getId(), wf.getNom(), Boolean.TRUE.equals(wf.getActif()), wf.getDateCreation(),
                derniere != null ? derniere.getStatut() : null,
                derniere != null ? derniere.getDateExecution() : null,
                executionRepository.countByWorkflowId(wf.getId()),
                executionRepository.countByWorkflowIdAndStatut(wf.getId(), "ECHEC"));
    }

    private SuperAdmin superAdmin(Authentication auth) {
        Utilisateur u = utilisateurRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil super administrateur introuvable"));
        if (!(u instanceof SuperAdmin sa)) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil super administrateur introuvable");
        }
        return sa;
    }

    private static String normaliser(String valeur, List<String> admises, String libelle) {
        if (valeur == null || valeur.isBlank()) {
            return null;
        }
        String v = valeur.trim().toUpperCase(Locale.ROOT);
        if (!admises.contains(v)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    libelle + " invalide. Valeurs : " + String.join(", ", admises));
        }
        return v;
    }
}