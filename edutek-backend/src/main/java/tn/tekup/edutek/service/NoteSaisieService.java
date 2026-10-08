package tn.tekup.edutek.service;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Note;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.security.AccesHelper;

import java.time.LocalDateTime;

/** Regles de saisie d'une note, partagees par la saisie unitaire et l'import CSV. */
@Service
@RequiredArgsConstructor
public class NoteSaisieService {

    private final NoteRepository noteRepository;
    private final RegleCalculService reglesService;
    private final NoteWorkflowService workflow;
    private final AccesHelper acces;

    /**
     * Verifie que l'appelant peut saisir des notes sur cette evaluation : proprietaire de l'enseignement
     * (ou administration pedagogique) ; l'enseignant n'a pas acces aux evaluations anonymes ni aux
     * enseignements clotures. Retourne vrai pour l'administration pedagogique.
     */
    public boolean verifierDroits(Evaluation ev, Authentication auth) {
        Enseignement ens = ev.getEnseignement();
        boolean admin = acces.estAdminPedagogie(auth);
        acces.verifierProprietaire(auth, ens);
        if (!admin) {
            if (Boolean.TRUE.equals(ev.getAnonyme())) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Evaluation anonyme : saisie reservee a l'administration pedagogique");
            }
            if (ens.getDateCloture() != null) {
                throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignement cloture : plus de saisie");
            }
        }
        return admin;
    }

    /** Cree une note : brouillon pour l'enseignant, soumise (et notifiee) pour l'administration pedagogique. */
    @Transactional
    public Note creer(Evaluation ev, Etudiant etu, Double valeur, String commentaire, boolean admin, String acteur) {
        acces.verifierEtudiantDansClasse(etu, ev.getEnseignement());
        if (noteRepository.existsByEvaluationIdAndEtudiantId(ev.getId(), etu.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une note existe deja pour cet etudiant et cette evaluation");
        }
        reglesService.verifierNote(valeur, ev);
        Note n = new Note();
        n.setValeur(valeur);
        n.setCommentaire(commentaire);
        n.setEvaluation(ev);
        n.setEtudiant(etu);
        n.setSaisiePar(acteur);
        if (admin) {
            n.setStatut("SOUMISE");
            n.setDateSoumission(LocalDateTime.now());
        } else {
            n.setStatut("BROUILLON");
        }
        Note saved = noteRepository.save(n);
        if (admin) {
            workflow.notifierNote(saved, "Nouvelle note");
        }
        return saved;
    }
}