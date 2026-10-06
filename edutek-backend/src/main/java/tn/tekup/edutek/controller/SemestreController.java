package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.SemestreDto;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.FormationRepository;
import tn.tekup.edutek.repository.SemestreRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/semestres")
@RequiredArgsConstructor
public class SemestreController {

    private final SemestreRepository semestreRepository;
    private final FormationRepository formationRepository;

    @GetMapping
    public List<SemestreDto> lister() {
        return semestreRepository.findAll().stream().map(SemestreDto::from).toList();
    }

    @GetMapping("/{id}")
    public SemestreDto detail(@PathVariable Long id) {
        return SemestreDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public SemestreDto creer(@Valid @RequestBody SemestreDto dto) {
        Semestre s = new Semestre();
        appliquer(s, dto);
        return SemestreDto.from(semestreRepository.save(s));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public SemestreDto modifier(@PathVariable Long id, @Valid @RequestBody SemestreDto dto) {
        Semestre s = trouver(id);
        appliquer(s, dto);
        return SemestreDto.from(semestreRepository.save(s));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        semestreRepository.delete(trouver(id));
    }

    private Semestre trouver(Long id) {
        return semestreRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + id));
    }

    private void appliquer(Semestre s, SemestreDto dto) {
        Formation f = formationRepository.findById(dto.formationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + dto.formationId()));
        s.setNom(dto.nom());
        s.setDateDebut(dto.dateDebut());
        s.setDateFin(dto.dateFin());
        s.setFormation(f);
    }
}