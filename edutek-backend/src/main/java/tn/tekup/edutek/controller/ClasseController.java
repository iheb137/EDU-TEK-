package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ClasseDto;
import tn.tekup.edutek.entity.Classe;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.FormationRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/classes")
@RequiredArgsConstructor
public class ClasseController {

    private final ClasseRepository classeRepository;
    private final FormationRepository formationRepository;

    @GetMapping
    public List<ClasseDto> lister() {
        return classeRepository.findAll().stream().map(ClasseDto::from).toList();
    }

    @GetMapping("/{id}")
    public ClasseDto detail(@PathVariable Long id) {
        return ClasseDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public ClasseDto creer(@Valid @RequestBody ClasseDto dto) {
        Classe c = new Classe();
        appliquer(c, dto);
        return ClasseDto.from(classeRepository.save(c));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public ClasseDto modifier(@PathVariable Long id, @Valid @RequestBody ClasseDto dto) {
        Classe c = trouver(id);
        appliquer(c, dto);
        return ClasseDto.from(classeRepository.save(c));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        classeRepository.delete(trouver(id));
    }

    private Classe trouver(Long id) {
        return classeRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + id));
    }

    private void appliquer(Classe c, ClasseDto dto) {
        Formation f = formationRepository.findById(dto.formationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + dto.formationId()));
        c.setCode(dto.code());
        c.setNom(dto.nom());
        c.setAnneeUniversitaire(dto.anneeUniversitaire());
        c.setFormation(f);
    }
}