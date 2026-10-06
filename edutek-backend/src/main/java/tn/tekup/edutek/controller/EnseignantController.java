package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.EnseignantRequest;
import tn.tekup.edutek.dto.EnseignantResponse;
import tn.tekup.edutek.entity.Enseignant;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.repository.EnseignantRepository;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/enseignants")
@RequiredArgsConstructor
public class EnseignantController {

    private final EnseignantRepository enseignantRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ADMIN_FINANCIER')")
    public List<EnseignantResponse> lister() {
        return enseignantRepository.findAll().stream().map(EnseignantResponse::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ADMIN_FINANCIER')")
    public EnseignantResponse detail(@PathVariable Long id) {
        return EnseignantResponse.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EnseignantResponse creer(@Valid @RequestBody EnseignantRequest req) {
        if (req.motDePasse() == null || req.motDePasse().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe obligatoire (8 caracteres minimum)");
        }
        if (utilisateurRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.email());
        }
        Enseignant e = new Enseignant();
        appliquer(e, req);
        e.setMotDePasse(passwordEncoder.encode(req.motDePasse()));
        Role role = roleRepository.findByNom("ENSEIGNANT").orElseThrow();
        e.getRoles().add(role);
        return EnseignantResponse.from(enseignantRepository.save(e));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EnseignantResponse modifier(@PathVariable Long id, @Valid @RequestBody EnseignantRequest req) {
        Enseignant e = trouver(id);
        if (!e.getEmail().equals(req.email()) && utilisateurRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.email());
        }
        appliquer(e, req);
        if (req.motDePasse() != null && !req.motDePasse().isBlank()) {
            e.setMotDePasse(passwordEncoder.encode(req.motDePasse()));
        }
        return EnseignantResponse.from(enseignantRepository.save(e));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        enseignantRepository.delete(trouver(id));
    }

    private Enseignant trouver(Long id) {
        return enseignantRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Enseignant introuvable : " + id));
    }

    private void appliquer(Enseignant e, EnseignantRequest req) {
        e.setNom(req.nom());
        e.setPrenom(req.prenom());
        e.setEmail(req.email());
        e.setTelephone(req.telephone());
        e.setMatricule(req.matricule());
        e.setSpecialite(req.specialite());
        e.setGrade(req.grade());
    }
}