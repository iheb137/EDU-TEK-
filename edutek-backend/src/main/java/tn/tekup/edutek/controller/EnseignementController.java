package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.EnseignementDto;
import tn.tekup.edutek.entity.*;
import tn.tekup.edutek.repository.*;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/enseignements")
@RequiredArgsConstructor
public class EnseignementController {

    private final EnseignementRepository enseignementRepository;
    private final EnseignantRepository enseignantRepository;
    private final MatiereRepository matiereRepository;
    private final ClasseRepository classeRepository;
    private final SemestreRepository semestreRepository;

    @GetMapping
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ADMIN_FINANCIER','ENSEIGNANT')")
    public List<EnseignementDto> lister() {
        return enseignementRepository.findAll().stream().map(EnseignementDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ADMIN_FINANCIER','ENSEIGNANT')")
    public EnseignementDto detail(@PathVariable Long id) {
        return EnseignementDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EnseignementDto creer(@Valid @RequestBody EnseignementDto dto) {
        Enseignement e = new Enseignement();
        appliquer(e, dto);
        return EnseignementDto.from(enseignementRepository.save(e));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EnseignementDto modifier(@PathVariable Long id, @Valid @RequestBody EnseignementDto dto) {
        Enseignement e = trouver(id);
        appliquer(e, dto);
        return EnseignementDto.from(enseignementRepository.save(e));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        enseignementRepository.delete(trouver(id));
    }

    private Enseignement trouver(Long id) {
        return enseignementRepository.findById(id).orElseThrow(() -> introuvable("Enseignement", id));
    }

    private ResponseStatusException introuvable(String type, Long id) {
        return new ResponseStatusException(HttpStatus.NOT_FOUND, type + " introuvable : " + id);
    }

    private void appliquer(Enseignement e, EnseignementDto dto) {
        Enseignant ens = enseignantRepository.findById(dto.enseignantId()).orElseThrow(() -> introuvable("Enseignant", dto.enseignantId()));
        Matiere mat = matiereRepository.findById(dto.matiereId()).orElseThrow(() -> introuvable("Matiere", dto.matiereId()));
        Classe cl = classeRepository.findById(dto.classeId()).orElseThrow(() -> introuvable("Classe", dto.classeId()));
        Semestre sem = semestreRepository.findById(dto.semestreId()).orElseThrow(() -> introuvable("Semestre", dto.semestreId()));

        if (!mat.getSemestre().getId().equals(sem.getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La matiere " + mat.getCode() + " n'appartient pas au semestre " + sem.getNom());
        }
        if (!cl.getFormation().getId().equals(sem.getFormation().getId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "La classe et le semestre doivent appartenir a la meme formation");
        }

        e.setGroupe(dto.groupe());
        e.setVolumeHoraire(dto.volumeHoraire());
        e.setEnseignant(ens);
        e.setMatiere(mat);
        e.setClasse(cl);
        e.setSemestre(sem);
    }
}