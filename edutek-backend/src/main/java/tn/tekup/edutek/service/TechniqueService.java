package tn.tekup.edutek.service;

import tn.tekup.edutek.entity.AlerteTechnique;
import tn.tekup.edutek.entity.ExecutionWorkflow;
import tn.tekup.edutek.entity.SuperAdmin;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.entity.WorkflowN8n;
import tn.tekup.edutek.repository.AlerteTechniqueRepository;
import tn.tekup.edutek.repository.ExecutionWorkflowRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.repository.WorkflowN8nRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class TechniqueService {

    public static final List<String> STATUTS_EXECUTION = List.of("SUCCES", "ECHEC", "EN_COURS");
    public static final List<String> NIVEAUX = List.of("INFO", "MOYEN", "ELEVE", "CRITIQUE");
    private static final String TYPE_ECHEC = "ECHEC_WORKFLOW";
    private static final List<String> ALERTES_NON_RESOLUES = List.of("OUVERTE", "ACQUITTEE");

    private final WorkflowN8nRepository workflowRepository;
    private final ExecutionWorkflowRepository executionRepository;
    private final AlerteTechniqueRepository alerteRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final NotificationService notificationService;

    /** Enregistre (ou met a jour, par identifiant externe) une execution ; un echec cree une alerte technique. */
    @Transactional
    public ExecutionWorkflow enregistrerExecution(String nomWorkflow, String statut, String idExterne,
                                                  Long dureeMs, String resultat) {
        String st = normaliser(statut, STATUTS_EXECUTION, "Statut");
        WorkflowN8n wf = workflowRepository.findByNom(nomWorkflow).orElseGet(() -> {
            WorkflowN8n w = new WorkflowN8n();
            w.setNom(nomWorkflow);
            return workflowRepository.save(w);
        });

        ExecutionWorkflow ex = null;
        if (idExterne != null && !idExterne.isBlank()) {
            ex = executionRepository.findByWorkflowIdAndIdExterne(wf.getId(), idExterne.trim()).orElse(null);
        }
        boolean dejaEnEchec = ex != null && "ECHEC".equals(ex.getStatut());
        if (ex == null) {
            ex = new ExecutionWorkflow();
            ex.setWorkflow(wf);
            ex.setIdExterne(idExterne == null || idExterne.isBlank() ? null : idExterne.trim());
        }
        ex.setStatut(st);
        ex.setDureeMs(dureeMs);
        ex.setResultat(resultat == null || resultat.isBlank() ? null : resultat.trim());
        ex = executionRepository.save(ex);

        if ("ECHEC".equals(st) && !dejaEnEchec
                && !alerteRepository.existsByTypeAndStatutInAndExecutionWorkflowId(TYPE_ECHEC, ALERTES_NON_RESOLUES, wf.getId())) {
            String detail = ex.getResultat() == null ? "" : " : " + ex.getResultat();
            AlerteTechnique a = creerAlerte(TYPE_ECHEC, "ELEVE", "Workflow " + wf.getNom() + " en echec" + detail, "n8n", ex);
            ex.getAlertesTechniques().add(a);
        }
        return ex;
    }

    /** Cree une alerte technique ; les niveaux ELEVE et CRITIQUE notifient les super administrateurs. */
    @Transactional
    public AlerteTechnique creerAlerte(String type, String niveau, String message, String source, ExecutionWorkflow execution) {
        String n = normaliser(niveau, NIVEAUX, "Niveau");
        AlerteTechnique a = new AlerteTechnique();
        a.setType(type);
        a.setNiveau(n);
        a.setMessage(coupe(message, 1000));
        a.setSource(source == null || source.isBlank() ? null : coupe(source.trim(), 100));
        a.setExecution(execution);
        AlerteTechnique saved = alerteRepository.save(a);
        if ("ELEVE".equals(n) || "CRITIQUE".equals(n)) {
            for (Utilisateur u : utilisateurRepository.findAll()) {
                if (u instanceof SuperAdmin && Boolean.TRUE.equals(u.getActif())) {
                    notificationService.notifier(u, "Alerte technique (" + n + ")", saved.getMessage());
                }
            }
        }
        return saved;
    }

    private static String normaliser(String valeur, List<String> admises, String libelle) {
        String v = valeur == null ? "" : valeur.trim().toUpperCase(Locale.ROOT);
        if (!admises.contains(v)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    libelle + " invalide. Valeurs : " + String.join(", ", admises));
        }
        return v;
    }

    private static String coupe(String s, int max) {
        return s != null && s.length() > max ? s.substring(0, max) : s;
    }
}