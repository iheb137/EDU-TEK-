package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.EvaluationDto;
import tn.tekup.edutek.dto.NoteDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Evaluation;
import tn.tekup.edutek.repository.EnseignementRepository;
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
@RequestMapping("/api/evaluations")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class EvaluationController {

    private final EvaluationRepository evaluationRepository;
    private final EnseignementRepository enseignementRepository;
    private final NoteRepository noteRepository;
    private final AccesHelper acces;

    @GetMapping
    @Transactional(readOnly = true)
    public List<EvaluationDto> lister(Authentication auth) {
        return evaluationRepository.findAll().stream()
                .filter(ev -> acces.estProprietaire(auth, ev.getEnseignement()))
                .map(EvaluationDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public EvaluationDto detail(@PathVariable Long id, Authentication auth) {
        Evaluation ev = trouver(id);
        acces.verifierProprietaire(auth, ev.getEnseignement());
        return EvaluationDto.from(ev);
    }

    @GetMapping("/{id}/notes")
    @Transactional(readOnly = true)
    public List<NoteDto> notes(@PathVariable Long id, Authentication auth) {
        Evaluation ev = trouver(id);
        acces.verifierProprietaire(auth, ev.getEnseignement());
        return noteRepository.findByEvaluationId(id).stream().map(NoteDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public EvaluationDto creer(@Valid @RequestBody EvaluationDto dto, Authentication auth) {
        Evaluation ev = new Evaluation();
        appliquer(ev, dto, auth);
        return EvaluationDto.from(evaluationRepository.save(ev));
    }

    @PutMapping("/{id}")
    @Transactional
    public EvaluationDto modifier(@PathVariable Long id, @Valid @RequestBody EvaluationDto dto, Authentication auth) {
        Evaluation ev = trouver(id);
        acces.verifierProprietaire(auth, ev.getEnseignement());
        appliquer(ev, dto, auth);
        return EvaluationDto.from(evaluationRepository.save(ev));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void supprimer(@PathVariable Long id, Authentication auth) {
        Evaluation ev = trouver(id);
        acces.verifierProprietaire(auth, ev.getEnseignement());
        evaluationRepository.delete(ev);
    }

    private Evaluation trouver(Long id) {
        return evaluationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Evaluation introuvable : " + id));
    }

    private void appliquer(Evaluation ev, EvaluationDto dto, Authentication auth) {
        Enseignement ens = enseignementRepository.findById(dto.enseignementId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignement introuvable : " + dto.enseignementId()));
        acces.verifierProprietaire(auth, ens);
        ev.setType(dto.type());
        ev.setDate(dto.date());
        ev.setCoefficient(dto.coefficient());
        ev.setEnseignement(ens);
    }
}