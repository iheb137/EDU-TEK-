package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.PresenceDto;
import tn.tekup.edutek.dto.SeanceDto;
import tn.tekup.edutek.entity.Enseignement;
import tn.tekup.edutek.entity.Seance;
import tn.tekup.edutek.repository.EnseignementRepository;
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

import java.util.List;

@RestController
@RequestMapping("/api/seances")
@RequiredArgsConstructor
@PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
public class SeanceController {

    private final SeanceRepository seanceRepository;
    private final EnseignementRepository enseignementRepository;
    private final PresenceRepository presenceRepository;
    private final AccesHelper acces;

    @GetMapping
    @Transactional(readOnly = true)
    public List<SeanceDto> lister(Authentication auth) {
        return seanceRepository.findAll().stream()
                .filter(s -> acces.estProprietaire(auth, s.getEnseignement()))
                .map(SeanceDto::from).toList();
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public SeanceDto detail(@PathVariable Long id, Authentication auth) {
        Seance s = trouver(id);
        acces.verifierProprietaire(auth, s.getEnseignement());
        return SeanceDto.from(s);
    }

    @GetMapping("/{id}/presences")
    @Transactional(readOnly = true)
    public List<PresenceDto> presences(@PathVariable Long id, Authentication auth) {
        Seance s = trouver(id);
        acces.verifierProprietaire(auth, s.getEnseignement());
        return presenceRepository.findBySeanceId(id).stream().map(PresenceDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public SeanceDto creer(@Valid @RequestBody SeanceDto dto, Authentication auth) {
        Seance s = new Seance();
        appliquer(s, dto, auth);
        return SeanceDto.from(seanceRepository.save(s));
    }

    @PutMapping("/{id}")
    @Transactional
    public SeanceDto modifier(@PathVariable Long id, @Valid @RequestBody SeanceDto dto, Authentication auth) {
        Seance s = trouver(id);
        acces.verifierProprietaire(auth, s.getEnseignement());
        appliquer(s, dto, auth);
        return SeanceDto.from(seanceRepository.save(s));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    public void supprimer(@PathVariable Long id, Authentication auth) {
        Seance s = trouver(id);
        acces.verifierProprietaire(auth, s.getEnseignement());
        seanceRepository.delete(s);
    }

    private Seance trouver(Long id) {
        return seanceRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Seance introuvable : " + id));
    }

    private void appliquer(Seance s, SeanceDto dto, Authentication auth) {
        if (!dto.heureFin().isAfter(dto.heureDebut())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "L'heure de fin doit etre apres l'heure de debut");
        }
        Enseignement ens = enseignementRepository.findById(dto.enseignementId()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignement introuvable : " + dto.enseignementId()));
        acces.verifierProprietaire(auth, ens);
        s.setDate(dto.date());
        s.setHeureDebut(dto.heureDebut());
        s.setHeureFin(dto.heureFin());
        s.setSalle(dto.salle());
        s.setEnseignement(ens);
    }
}