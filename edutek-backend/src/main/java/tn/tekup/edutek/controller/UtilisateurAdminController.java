package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.ActivationRequest;
import tn.tekup.edutek.dto.MotDePasseTemporaireDto;
import tn.tekup.edutek.dto.PageDto;
import tn.tekup.edutek.dto.RolesRequest;
import tn.tekup.edutek.dto.UtilisateurAdminDto;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.entity.Utilisateur;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.repository.UtilisateurRepository;
import tn.tekup.edutek.service.AuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.Authentication;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/utilisateurs")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class UtilisateurAdminController {

    private static final String ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    private static final SecureRandom RANDOM = new SecureRandom();

    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    @GetMapping
    @Transactional(readOnly = true)
    public PageDto<UtilisateurAdminDto> lister(@RequestParam(defaultValue = "") String q,
                                               @RequestParam(required = false) Boolean actif,
                                               @RequestParam(defaultValue = "0") int page,
                                               @RequestParam(defaultValue = "20") int size) {
        if (page < 0 || size < 1 || size > 100) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "page >= 0 et 1 <= size <= 100");
        }
        if (q.length() > 50) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Recherche limitee a 50 caracteres");
        }
        List<Boolean> actifs = actif == null ? List.of(true, false) : List.of(actif);
        Page<Utilisateur> p = utilisateurRepository.rechercherAdmin(q.trim(), actifs,
                PageRequest.of(page, size, Sort.by("nom", "prenom")));
        return new PageDto<>(p.getContent().stream().map(UtilisateurAdminDto::from).toList(),
                p.getNumber(), p.getSize(), p.getTotalElements(), p.getTotalPages());
    }

    @GetMapping("/{id}")
    @Transactional(readOnly = true)
    public UtilisateurAdminDto detail(@PathVariable Long id) {
        return UtilisateurAdminDto.from(trouver(id));
    }

    @PatchMapping("/{id}/activation")
    @Transactional
    public UtilisateurAdminDto activation(@PathVariable Long id, @Valid @RequestBody ActivationRequest req,
                                          Authentication auth) {
        Utilisateur u = trouver(id);
        if (!req.actif() && u.getEmail().equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas desactiver votre propre compte");
        }
        u.setActif(req.actif());
        audit.log(req.actif() ? "COMPTE_ACTIVE" : "COMPTE_DESACTIVE", "Utilisateur", id, u.getEmail());
        return UtilisateurAdminDto.from(u);
    }

    @PutMapping("/{id}/roles")
    @Transactional
    public UtilisateurAdminDto definirRoles(@PathVariable Long id, @Valid @RequestBody RolesRequest req,
                                            Authentication auth) {
        Utilisateur u = trouver(id);
        if (u.getEmail().equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vous ne pouvez pas modifier vos propres roles");
        }
        Set<String> noms = req.roles().stream()
                .map(r -> r.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        String principal = UtilisateurAdminDto.typeDe(u);
        if (!noms.contains(principal)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Le role " + principal + " est obligatoire pour ce type de compte");
        }
        List<Role> roles = new ArrayList<>();
        for (String nom : noms) {
            roles.add(roleRepository.findByNom(nom).orElseThrow(() ->
                    new ResponseStatusException(HttpStatus.NOT_FOUND, "Role introuvable : " + nom)));
        }
        u.getRoles().clear();
        u.getRoles().addAll(roles);
        audit.log("ROLES_MODIFIES", "Utilisateur", id, u.getEmail() + " -> " + noms);
        return UtilisateurAdminDto.from(u);
    }

    @PostMapping("/{id}/reinitialiser-mot-de-passe")
    @Transactional
    public ResponseEntity<MotDePasseTemporaireDto> reinitialiser(@PathVariable Long id, Authentication auth) {
        Utilisateur u = trouver(id);
        if (u.getEmail().equals(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Pour votre propre compte, utilisez /api/auth/changer-mot-de-passe");
        }
        String temporaire = genererMotDePasse();
        u.setMotDePasse(passwordEncoder.encode(temporaire));
        u.setMdpTemporaire(true);
        audit.log("MDP_REINITIALISE", "Utilisateur", id, u.getEmail());
        return ResponseEntity.ok()
                .header(HttpHeaders.CACHE_CONTROL, "no-store")
                .body(new MotDePasseTemporaireDto(u.getEmail(), temporaire,
                        "A transmettre de facon securisee. Il devra etre change a la prochaine connexion."));
    }

    private Utilisateur trouver(Long id) {
        return utilisateurRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Utilisateur introuvable : " + id));
    }

    private static String genererMotDePasse() {
        StringBuilder sb = new StringBuilder(14);
        for (int i = 0; i < 14; i++) {
            sb.append(ALPHABET.charAt(RANDOM.nextInt(ALPHABET.length())));
        }
        return sb.toString();
    }
}