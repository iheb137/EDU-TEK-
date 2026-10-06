package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ActualiteDto;
import tn.tekup.edutek.dto.ActualiteRequest;
import tn.tekup.edutek.dto.PageDto;
import tn.tekup.edutek.entity.Actualite;
import tn.tekup.edutek.entity.AdminCommunication;
import tn.tekup.edutek.repository.ActualiteRepository;
import tn.tekup.edutek.repository.AdminCommunicationRepository;
import tn.tekup.edutek.service.DiffusionService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api/actualites")
@RequiredArgsConstructor
public class ActualiteController {

    private static final String COMMUNICATION = "hasRole('ADMIN_COMMUNICATION')";

    private final ActualiteRepository actualiteRepository;
    private final AdminCommunicationRepository adminCommunicationRepository;
    private final DiffusionService diffusionService;

    @GetMapping
    @Transactional(readOnly = true)
    public PageDto<ActualiteDto> lister(@RequestParam(defaultValue = "") String q,
                                        @RequestParam(defaultValue = "0") int page,
                                        @RequestParam(defaultValue = "10") int size) {
        if (page < 0 || size < 1 || size > 50 || q.length() > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "page >= 0, 1 <= size <= 50, recherche limitee a 100 caracteres");
        }
        PageRequest pageable = PageRequest.of(page, size, Sort.by(Sort.Direction.DESC, "datePublication"));
        Page<Actualite> p = q.isBlank()
                ? actualiteRepository.findAll(pageable)
                : actualiteRepository.findByTitreContainingIgnoreCase(q.trim(), pageable);
        return new PageDto<>(p.getContent().stream().map(ActualiteDto::from).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public ActualiteDto detail(@PathVariable Long id) {
        return ActualiteDto.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize(COMMUNICATION)
    public ActualiteDto publier(@Valid @RequestBody ActualiteRequest req,
                                @RequestParam(defaultValue = "false") boolean notifier,
                                Authentication auth) {
        AdminCommunication auteur = adminCommunicationRepository.findByEmail(auth.getName()).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.FORBIDDEN, "Profil administrateur communication introuvable"));
        Actualite a = new Actualite();
        a.setAuteur(auteur);
        appliquer(a, req);
        Actualite saved = actualiteRepository.save(a);
        if (notifier) {
            diffusionService.diffuser("TOUS", null, "Nouvelle actualite", saved.getTitre());
        }
        return ActualiteDto.from(saved);
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize(COMMUNICATION)
    public ActualiteDto modifier(@PathVariable Long id, @Valid @RequestBody ActualiteRequest req) {
        Actualite a = trouver(id);
        appliquer(a, req);
        return ActualiteDto.from(a);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_COMMUNICATION')")
    public void supprimer(@PathVariable Long id) {
        actualiteRepository.delete(trouver(id));
    }

    private Actualite trouver(Long id) {
        return actualiteRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Actualite introuvable : " + id));
    }

    private void appliquer(Actualite a, ActualiteRequest req) {
        a.setTitre(req.titre().trim());
        a.setContenu(req.contenu().trim());
        a.setLienDocument(req.lienDocument() == null || req.lienDocument().isBlank() ? null : req.lienDocument().trim());
    }
}