package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.PresenceDto;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Presence;
import tn.tekup.edutek.entity.Seance;
import tn.tekup.edutek.repository.EtudiantRepository;
import tn.tekup.edutek.repository.PresenceRepository;
import tn.tekup.edutek.repository.SeanceRepository;
import tn.tekup.edutek.security.AccesHelper;
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

@RestController
@RequestMapping("/api/presences")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class PresenceController {

    private final PresenceRepository presenceRepository;
    private final SeanceRepository seanceRepository;
    private final EtudiantRepository etudiantRepository;
    private final AccesHelper acces;

    @GetMapping("/mes-presences")
    @Transactional(readOnly = true)
    @PreAuthorize("hasRole('ETUDIANT')")
    public List<PresenceDto> mesPresences(Authentication auth) {
        return presenceRepository.findByEtudiantEmail(auth.getName()).stream().map(PresenceDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public PresenceDto creer(@Valid @RequestBody PresenceDto dto, Authentication auth) {
        Seance s = seanceRepository.findById(dto.seanceId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Seance introuvable : " + dto.seanceId()));
        acces.verifierProprietaire(auth, s.getEnseignement());
        Etudiant etu = etudiantRepository.findById(dto.etudiantId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + dto.etudiantId()));
        acces.verifierEtudiantDansClasse(etu, s.getEnseignement());
        if (presenceRepository.existsBySeanceIdAndEtudiantId(s.getId(), etu.getId())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Presence deja pointee pour cet etudiant et cette seance");
        }
        Presence p = new Presence();
        p.setPresent(dto.present());
        p.setJustification(dto.justification());
        p.setDatePointage(LocalDateTime.now());
        p.setSeance(s);
        p.setEtudiant(etu);
        return PresenceDto.from(presenceRepository.save(p));
    }

    @PutMapping("/{id}")
    @Transactional
    public PresenceDto modifier(@PathVariable Long id, @Valid @RequestBody PresenceDto dto, Authentication auth) {
        Presence p = trouver(id);
        acces.verifierProprietaire(auth, p.getSeance().getEnseignement());
        p.setPresent(dto.present());
        p.setJustification(dto.justification());
        return PresenceDto.from(presenceRepository.save(p));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void supprimer(@PathVariable Long id, Authentication auth) {
        Presence p = trouver(id);
        acces.verifierProprietaire(auth, p.getSeance().getEnseignement());
        presenceRepository.delete(p);
    }

    private Presence trouver(Long id) {
        return presenceRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Presence introuvable : " + id));
    }
}