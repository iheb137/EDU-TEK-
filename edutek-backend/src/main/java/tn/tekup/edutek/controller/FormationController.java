package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.FormationDto;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.repository.FormationRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/formations")
@RequiredArgsConstructor
public class FormationController {

    private final FormationRepository formationRepository;

    @GetMapping
    public List<FormationDto> lister() {
        return formationRepository.findAll().stream().map(FormationDto::from).toList();
    }

    @GetMapping("/{id}")
    public FormationDto detail(@PathVariable Long id) {
        return FormationDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public FormationDto creer(@Valid @RequestBody FormationDto dto) {
        Formation f = new Formation();
        appliquer(f, dto);
        return FormationDto.from(formationRepository.save(f));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public FormationDto modifier(@PathVariable Long id, @Valid @RequestBody FormationDto dto) {
        Formation f = trouver(id);
        appliquer(f, dto);
        return FormationDto.from(formationRepository.save(f));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        formationRepository.delete(trouver(id));
    }

    private Formation trouver(Long id) {
        return formationRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + id));
    }

    private void appliquer(Formation f, FormationDto dto) {
        f.setCode(dto.code());
        f.setNom(dto.nom());
        f.setNiveau(dto.niveau());
    }
}