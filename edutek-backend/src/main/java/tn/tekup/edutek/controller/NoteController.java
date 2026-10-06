package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.NoteDto;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.entity.Note;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.EvaluationRepository;
import tn.tekup.edutek.repository.NoteRepository;
import tn.tekup.edutek.security.AccesHelper;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/notes")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class NoteController {

    private final NoteRepository noteRepository;
    private final EvaluationRepository evaluationRepository;
    private final EtudiantRepository etudiantRepository;
    private final AccesHelper acces;

    @GetMapping("/mes-notes")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<NoteDto> mesNotes(Authentication auth) {
        return noteRepository.findByEtudiantEmail(auth.getName()).stream().map(NoteDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public NoteDto creer(@Valid @RequestBody NoteDto dto, Authentication auth) {
        verifierValeur(dto.valeur());
        Evaluation ev = evaluationRepository.findById(dto.evaluationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + dto.evaluationId()));
        acces.verifierProprietaire(auth, ev.getEnseignement());
        Etudiant etu = etudiantRepository.findById(dto.etudiantId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + dto.etudiantId()));
        acces.verifierEtudiantDansClasse(etu, ev.getEnseignement());
        if (noteRepository.existsByEvaluationIdAndEtudiantId(ev.getId(), etu.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Une note existe deja pour cet etudiant et cette evaluation");
        }
        Note n = new Note();
        n.setValeur(dto.valeur());
        n.setCommentaire(dto.commentaire());
        n.setEvaluation(ev);
        n.setEtudiant(etu);
        return NoteDto.from(noteRepository.save(n));
    }

    @PutMapping("/{id}")
    @Transactional
    public NoteDto modifier(@PathVariable Long id, @Valid @RequestBody NoteDto dto, Authentication auth) {
        verifierValeur(dto.valeur());
        Note n = trouver(id);
        acces.verifierProprietaire(auth, n.getEvaluation().getEnseignement());
        n.setValeur(dto.valeur());
        n.setCommentaire(dto.commentaire());
        return NoteDto.from(noteRepository.save(n));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void supprimer(@PathVariable Long id, Authentication auth) {
        Note n = trouver(id);
        acces.verifierProprietaire(auth, n.getEvaluation().getEnseignement());
        noteRepository.delete(n);
    }

    private Note trouver(Long id) {
        return noteRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Note introuvable : " + id));
    }

    private void verifierValeur(Double valeur) {
        if (valeur < 0 || valeur > 20) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "La note doit etre comprise entre 0 et 20");
        }
    }
}