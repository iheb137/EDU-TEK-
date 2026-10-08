package tn.tekup.edutek.service;

import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.*;
import tn.tekup.edutek.repository.EnseignementRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.repository.ResultatSemestreRepository;

import java.time.LocalDateTime;
import java.util.List;

/** Cycle de vie des notes : brouillon, soumission, cloture d'un enseignement, invalidation des resultats. */
@Service
@RequiredArgsConstructor
public class NoteWorkflowService {

    private final NoteRepository noteRepository;
    private final EnseignementRepository enseignementRepository;
    private final ResultatSemestreRepository resultatRepository;
    private final NotificationService notificationService;
    private final AuditService audit;

    @PersistenceContext
    private EntityManager em;

    /** Passe en SOUMISE toutes les notes en brouillon d'une evaluation et previent chaque etudiant. */
    @Transactional
    public int soumettre(Evaluation ev) {
        List<Note> brouillons = noteRepository.findByEvaluationId(ev.getId()).stream()
                .filter(n -> "BROUILLON".equals(n.getStatut())).toList();
        if (brouillons.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Aucune note en brouillon a soumettre");
        }
        LocalDateTime maintenant = LocalDateTime.now();
        for (Note n : brouillons) {
            n.setStatut("SOUMISE");
            n.setDateSoumission(maintenant);
            noteRepository.save(n);
            notifierNote(n, "Nouvelle note");
        }
        audit.log("NOTES_SOUMISES", "Evaluation", ev.getId(), brouillons.size() + " note(s)");
        invaliderResultats(ev.getEnseignement().getSemestre().getId());
        return brouillons.size();
    }

    public void notifierNote(Note n, String titre) {
        Evaluation ev = n.getEvaluation();
        String type = ev.getType() != null ? ev.getType() : "Evaluation";
        notificationService.notifier(n.getEtudiant(), titre,
                type + " - " + ev.getEnseignement().getMatiere().getNom() + " : " + n.getValeur());
    }

    @Transactional
    public void cloturer(Enseignement ens, String acteur) {
        if (ens.getDateCloture() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignement deja cloture");
        }
        long brouillons = noteRepository.countByEvaluationEnseignementIdAndStatut(ens.getId(), "BROUILLON");
        if (brouillons > 0) {
            throw new ResponseStatusException(HttpStatus.CONFLICT,
                    brouillons + " note(s) en brouillon : soumettez-les avant de cloturer");
        }
        ens.setDateCloture(LocalDateTime.now());
        ens.setClotureePar(acteur);
        enseignementRepository.save(ens);
        audit.log("ENSEIGNEMENT_CLOTURE", "Enseignement", ens.getId(), ens.getMatiere().getNom());
        Semestre sem = ens.getSemestre();
        boolean tousClotures = enseignementRepository.findBySemestreId(sem.getId()).stream()
                .allMatch(e -> e.getDateCloture() != null);
        if (tousClotures) {
            List<AdminPedagogique> admins = em.createQuery("select a from AdminPedagogique a", AdminPedagogique.class)
                    .getResultList();
            for (AdminPedagogique a : admins) {
                notificationService.notifier(a, "Calcul des resultats possible",
                        "Tous les enseignements du semestre " + sem.getNom() + " sont clotures.");
            }
        }
    }

    @Transactional
    public void rouvrir(Enseignement ens) {
        if (ens.getDateCloture() == null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignement non cloture");
        }
        ens.setDateCloture(null);
        ens.setClotureePar(null);
        enseignementRepository.save(ens);
        audit.log("ENSEIGNEMENT_ROUVERT", "Enseignement", ens.getId(), ens.getMatiere().getNom());
        invaliderResultats(ens.getSemestre().getId());
    }

    /** Une note a change : les resultats deja calcules ou publies du semestre doivent etre recalcules. */
    @Transactional
    public void invaliderResultats(Long semestreId) {
        for (ResultatSemestre r : resultatRepository.findBySemestreId(semestreId)) {
            if (!"A_RECALCULER".equals(r.getStatut())) {
                r.setStatut("A_RECALCULER");
                resultatRepository.save(r);
            }
        }
    }
}