package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.EtudiantRequest;
import tn.tekup.edutek.dto.EtudiantResponse;
import tn.tekup.edutek.entity.Classe;
import tn.tekup.edutek.entity.Etudiant;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.repository.ClasseRepository;
import tn.tekup.edutek.repository.EtudiantRepository;
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
@RequestMapping("/api/etudiants")
@RequiredArgsConstructor
public class EtudiantController {

    private final EtudiantRepository etudiantRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final ClasseRepository classeRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;

    @GetMapping
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
    public List<EtudiantResponse> lister() {
        return etudiantRepository.findAll().stream().map(EtudiantResponse::from).toList();
    }

    @GetMapping("/{id}")
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE','ENSEIGNANT')")
    public EtudiantResponse detail(@PathVariable Long id) {
        return EtudiantResponse.from(trouver(id));
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EtudiantResponse creer(@Valid @RequestBody EtudiantRequest req) {
        if (req.motDePasse() == null || req.motDePasse().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Mot de passe obligatoire (8 caracteres minimum)");
        }
        if (utilisateurRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.email());
        }
        Etudiant e = new Etudiant();
        appliquer(e, req);
        e.setMotDePasse(passwordEncoder.encode(req.motDePasse()));
        Role role = roleRepository.findByNom("ETUDIANT").orElseThrow();
        e.getRoles().add(role);
        return EtudiantResponse.from(etudiantRepository.save(e));
    }

    @PutMapping("/{id}")
    @Transactional
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public EtudiantResponse modifier(@PathVariable Long id, @Valid @RequestBody EtudiantRequest req) {
        Etudiant e = trouver(id);
        if (!e.getEmail().equals(req.email()) && utilisateurRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.email());
        }
        appliquer(e, req);
        if (req.motDePasse() != null && !req.motDePasse().isBlank()) {
            e.setMotDePasse(passwordEncoder.encode(req.motDePasse()));
        }
        return EtudiantResponse.from(etudiantRepository.save(e));
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @PreAuthorize("hasAnyRole('SUPERADMIN','ADMIN_PEDAGOGIQUE')")
    public void supprimer(@PathVariable Long id) {
        etudiantRepository.delete(trouver(id));
    }

    private Etudiant trouver(Long id) {
        return etudiantRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Etudiant introuvable : " + id));
    }

    private void appliquer(Etudiant e, EtudiantRequest req) {
        e.setNom(req.nom());
        e.setPrenom(req.prenom());
        e.setEmail(req.email());
        e.setTelephone(req.telephone());
        e.setMatricule(req.matricule());
        e.setNiveau(req.niveau());
        if (req.classeId() != null) {
            Classe c = classeRepository.findById(req.classeId()).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Classe introuvable : " + req.classeId()));
            e.setClasse(c);
        } else {
            e.setClasse(null);
        }
    }
}