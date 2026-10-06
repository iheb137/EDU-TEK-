package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.InscriptionDto;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Formation;
import tn.tekup.edutek.entity.Inscription;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.FormationRepository;
import tn.tekup.edutek.repository.InscriptionRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/inscriptions")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
public class InscriptionController {

    private final InscriptionRepository inscriptionRepository;
    private final EtudiantRepository etudiantRepository;
    private final FormationRepository formationRepository;

    @GetMapping
    @Transactional(readOnly = true)
    public List<InscriptionDto> lister() {
        return inscriptionRepository.findAll().stream().map(InscriptionDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public InscriptionDto detail(@PathVariable Long id) {
        return InscriptionDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public InscriptionDto creer(@Valid @RequestBody InscriptionDto dto) {
        Etudiant etu = etudiantRepository.findById(dto.etudiantId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + dto.etudiantId()));
        Formation f = formationRepository.findById(dto.formationId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Formation introuvable : " + dto.formationId()));
        if (inscriptionRepository.existsByEtudiantIdAndFormationId(etu.getId(), f.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Cet etudiant est deja inscrit a cette formation");
        }
        Inscription i = new Inscription();
        i.setEtudiant(etu);
        i.setFormation(f);
        i.setDateInscription(dto.dateInscription() != null ? dto.dateInscription() : LocalDate.now());
        i.setStatut(dto.statut() != null ? dto.statut() : "ACTIVE");
        return InscriptionDto.from(inscriptionRepository.save(i));
    }

    @PutMapping("/{id}")
    @Transactional
    public InscriptionDto modifier(@PathVariable Long id, @Valid @RequestBody InscriptionDto dto) {
        Inscription i = trouver(id);
        if (!i.getEtudiant().getId().equals(dto.etudiantId()) || !i.getFormation().getId().equals(dto.formationId())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "L'etudiant et la formation d'une inscription ne sont pas modifiables");
        }
        if (dto.dateInscription() != null) i.setDateInscription(dto.dateInscription());
        if (dto.statut() != null) i.setStatut(dto.statut());
        return InscriptionDto.from(inscriptionRepository.save(i));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        inscriptionRepository.delete(trouver(id));
    }

    private Inscription trouver(Long id) {
        return inscriptionRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Inscription introuvable : " + id));
    }
}