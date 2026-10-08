package tn.tekup.edutek.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.security.AccesHelper;
import tn.tekup.edutek.service.NoteWorkflowService;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Map;

/** Soumission des notes, cloture d'un enseignement et suivi d'avancement. */
@RestController
@RequestMapping("/api")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class NotesWorkflowController {

    public record EvaluationAvancement(Long id, String type, boolean anonyme, int attendues, long brouillons, long soumises) {}

    public record AvancementEnseignement(Long id, boolean cloture, LocalDateTime dateCloture,
                                         List<EvaluationAvancement> evaluations) {}

    private final EvaluationRepository evaluationRepository;
    private final EnseignementRepository enseignementRepository;
    private final EtudiantRepository etudiantRepository;
    private final NoteRepository noteRepository;
    private final AccesHelper acces;
    private final NoteWorkflowService workflow;

    @PostMapping("/evaluations/{id}/soumettre")
    @Transactional
    public Map<String, Object> soumettre(@PathVariable Long id, Authentication auth) {
        Evaluation ev = evaluationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + id));
        Enseignement ens = ev.getEnseignement();
        acces.verifierProprietaire(auth, ens);
        if (!acces.estAdminPedagogie(auth)) {
            if (Boolean.TRUE.equals(ev.getAnonyme())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Evaluation anonyme : reservee a l'administration pedagogique");
            }
            if (ens.getDateCloture() != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignement cloture");
            }
        }
        return Map.of("soumises", workflow.soumettre(ev));
    }

    @PostMapping("/enseignements/{id}/cloturer")
    @Transactional
    public Map<String, Object> cloturer(@PathVariable Long id, Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        workflow.cloturer(ens, auth.getName());
        return Map.of("cloture", true);
    }

    @PostMapping("/enseignements/{id}/rouvrir")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public Map<String, Object> rouvrir(@PathVariable Long id) {
        workflow.rouvrir(enseignement(id));
        return Map.of("cloture", false);
    }

    @GetMapping("/enseignements/{id}/avancement")
    @Transactional(readOnly = true)
    public AvancementEnseignement avancement(@PathVariable Long id, Authentication auth) {
        Enseignement ens = enseignement(id);
        acces.verifierProprietaire(auth, ens);
        int attendues = etudiantRepository.findByClasseId(ens.getClasse().getId()).size();
        List<EvaluationAvancement> lignes = evaluationRepository.findByEnseignementId(id).stream().map(ev -> {
            long total = noteRepository.countByEvaluationId(ev.getId());
            long brouillons = noteRepository.countByEvaluationIdAndStatut(ev.getId(), "BROUILLON");
            return new EvaluationAvancement(ev.getId(), ev.getType(), Boolean.TRUE.equals(ev.getAnonyme()),
                    attendues, brouillons, total - brouillons);
        }).toList();
        return new AvancementEnseignement(id, ens.getDateCloture() != null, ens.getDateCloture(), lignes);
    }

    private Enseignement enseignement(Long id) {
        return enseignementRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignement introuvable : " + id));
    }
}