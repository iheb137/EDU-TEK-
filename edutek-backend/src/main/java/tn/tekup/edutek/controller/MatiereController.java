package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.MatiereDto;
import tn.tekup.edutek.entity.Matiere;
import tn.tekup.edutek.entity.Semestre;
import tn.tekup.edutek.repository.MatiereRepository;
import tn.tekup.edutek.repository.SemestreRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/matieres")
@RequiredArgsConstructor
public class MatiereController {

    private final MatiereRepository matiereRepository;
    private final SemestreRepository semestreRepository;

    @GetMapping
    public List<MatiereDto> lister() {
        return matiereRepository.findAll().stream().map(MatiereDto::from).toList();
    }

    @GetMapping("/{id}")
    public MatiereDto detail(@PathVariable Long id) {
        return MatiereDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public MatiereDto creer(@Valid @RequestBody MatiereDto dto) {
        Matiere m = new Matiere();
        appliquer(m, dto);
        return MatiereDto.from(matiereRepository.save(m));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public MatiereDto modifier(@PathVariable Long id, @Valid @RequestBody MatiereDto dto) {
        Matiere m = trouver(id);
        appliquer(m, dto);
        return MatiereDto.from(matiereRepository.save(m));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        matiereRepository.delete(trouver(id));
    }

    private Matiere trouver(Long id) {
        return matiereRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Matiere introuvable : " + id));
    }

    private void appliquer(Matiere m, MatiereDto dto) {
        Semestre s = semestreRepository.findById(dto.semestreId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Semestre introuvable : " + dto.semestreId()));
        m.setCode(dto.code());
        m.setNom(dto.nom());
        m.setCoefficient(dto.coefficient());
        m.setCredits(dto.credits());
        m.setSemestre(s);
    }
}