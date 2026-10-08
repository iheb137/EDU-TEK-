package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.NoteDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Note;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.security.AccesHelper;
import tn.tekup.edutek.service.AuditService;
import tn.tekup.edutek.service.NoteWorkflowService;
import tn.tekup.edutek.service.RegleCalculService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDateTime;
import java.util.List;

/**
 * Saisie des notes. L'enseignant saisit en brouillon puis soumet (voir NotesWorkflowController) ; une note
 * soumise n'est plus modifiable par lui. L'administration pedagogique saisit les evaluations anonymes
 * (notes directement soumises) et corrige les notes soumises avec un motif journalise.
 */
@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class NoteController {

    private final NoteRepository noteRepository;
    private final EvaluationRepository evaluationRepository;
    private final EtudiantRepository etudiantRepository;
    private final AccesHelper acces;
    private final RegleCalculService reglesService;
    private final NoteWorkflowService workflow;
    private final AuditService audit;

    @GetMapping("/mes-notes")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<NoteDto> mesNotes(Authentication auth) {
        return noteRepository.findByEtudiantEmail(auth.getName()).stream()
                .filter(Note::estSoumise).map(NoteDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public NoteDto creer(@Valid @RequestBody NoteDto dto, Authentication auth) {
        verifierValeur(dto.valeur());
        Evaluation ev = evaluationRepository.findById(dto.evaluationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + dto.evaluationId()));
        Enseignement ens = ev.getEnseignement();
        boolean admin = acces.estAdminPedagogie(auth);
        acces.verifierProprietaire(auth, ens);
        if (!admin) {
            verifierSaisieEnseignant(ev, ens);
        }
        Etudiant etu = etudiantRepository.findById(dto.etudiantId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + dto.etudiantId()));
        acces.verifierEtudiantDansClasse(etu, ens);
        if (noteRepository.existsByEvaluationIdAndEtudiantId(ev.getId(), etu.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une note existe deja pour cet etudiant et cette evaluation");
        }
        reglesService.verifierNote(dto.valeur(), ev);
        Note n = new Note();
        n.setValeur(dto.valeur());
        n.setCommentaire(dto.commentaire());
        n.setEvaluation(ev);
        n.setEtudiant(etu);
        n.setSaisiePar(auth.getName());
        if (admin) {
            n.setStatut("SOUMISE");
            n.setDateSoumission(LocalDateTime.now());
        } else {
            n.setStatut("BROUILLON");
        }
        Note saved = noteRepository.save(n);
        if (admin) {
            workflow.notifierNote(saved, "Nouvelle note");
            workflow.invaliderResultats(ens.getSemestre().getId());
        }
        return NoteDto.from(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    public NoteDto modifier(@PathVariable Long id, @Valid @RequestBody NoteDto dto,
                            @RequestParam(required = false) String motif, Authentication auth) {
        verifierValeur(dto.valeur());
        Note n = trouver(id);
        Evaluation ev = n.getEvaluation();
        Enseignement ens = ev.getEnseignement();
        boolean admin = acces.estAdminPedagogie(auth);
        acces.verifierProprietaire(auth, ens);
        if (!admin) {
            verifierSaisieEnseignant(ev, ens);
            if (n.estSoumise()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Note soumise : seule l'administration pedagogique peut la corriger");
            }
        }
        boolean correction = admin && n.estSoumise();
        if (correction) {
            exigerMotif(motif);
        }
        reglesService.verifierNote(dto.valeur(), ev);
        Double ancienne = n.getValeur();
        n.setValeur(dto.valeur());
        n.setCommentaire(dto.commentaire());
        Note saved = noteRepository.save(n);
        if (correction) {
            audit.log("NOTE_CORRIGEE", "Note", id, "ancienne=" + ancienne + " nouvelle=" + dto.valeur() + " motif=" + motif);
            workflow.notifierNote(saved, "Note corrigee");
            workflow.invaliderResultats(ens.getSemestre().getId());
        }
        return NoteDto.from(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void supprimer(@PathVariable Long id, @RequestParam(required = false) String motif, Authentication auth) {
        Note n = trouver(id);
        Evaluation ev = n.getEvaluation();
        Enseignement ens = ev.getEnseignement();
        boolean admin = acces.estAdminPedagogie(auth);
        acces.verifierProprietaire(auth, ens);
        if (!admin) {
            verifierSaisieEnseignant(ev, ens);
            if (n.estSoumise()) {
                throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                        "Note soumise : seule l'administration pedagogique peut la supprimer");
            }
        } else if (n.estSoumise()) {
            exigerMotif(motif);
            audit.log("NOTE_SUPPRIMEE", "Note", id, "valeur=" + n.getValeur() + " motif=" + motif);
            workflow.notifierNote(n, "Note supprimee");
            workflow.invaliderResultats(ens.getSemestre().getId());
        }
        noteRepository.delete(n);
    }

    private void verifierSaisieEnseignant(Evaluation ev, Enseignement ens) {
        if (Boolean.TRUE.equals(ev.getAnonyme())) {
            throw new ResponseStatusException(HttpStatus.FORBIDDEN,
                    "Evaluation anonyme : saisie reservee a l'administration pedagogique");
        }
        if (ens.getDateCloture() != null) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Enseignement cloture : plus de saisie");
        }
    }

    private static void exigerMotif(String motif) {
        if (motif == null || motif.isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Motif obligatoire pour modifier une note soumise");
        }
    }

    private Note trouver(Long id) {
        return noteRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Note introuvable : " + id));
    }

    private void verifierValeur(Double valeur) {
        if (valeur == null || valeur < 0) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La note ne peut pas etre negative");
        }
    }
}