package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.AdminRequest;
import tn.tekup.edutek.dto.AdminResponse;
import tn.tekup.edutek.entity.*;
import tn.tekup.edutek.repository.AdministrateurRepository;
import tn.tekup.edutek.service.AuditService;
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
@RequestMapping("/api/admins")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class AdminController {

    private final AdministrateurRepository administrateurRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuditService audit;

    @GetMapping
    @Transactional(readOnly = true)
    public List<AdminResponse> lister() {
        return administrateurRepository.findAll().stream().map(AdminResponse::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public AdminResponse creer(@Valid @RequestBody AdminRequest req) {
        if (utilisateurRepository.existsByEmail(req.email())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Email deja utilise : " + req.email());
        }
        String type = req.type().toUpperCase();
        Administrateur admin = switch (type) {
            case "SUPERADMIN" -> new SuperAdmin();
            case "ADMIN_PEDAGOGIQUE" -> new AdminPedagogique();
            case "ADMIN_COMMUNICATION" -> new AdminCommunication();
            case "ADMIN_SUPPORT" -> new AdminSupport();
            case "ADMIN_FINANCIER" -> new AdminFinancier();
            default -> throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Type invalide. Valeurs : SUPERADMIN, ADMIN_PEDAGOGIQUE, ADMIN_COMMUNICATION, ADMIN_SUPPORT, ADMIN_FINANCIER");
        };
        admin.setNom(req.nom());
        admin.setPrenom(req.prenom());
        admin.setEmail(req.email());
        admin.setTelephone(req.telephone());
        admin.setMotDePasse(passwordEncoder.encode(req.motDePasse()));
        Role role = roleRepository.findByNom(type).orElseThrow();
        admin.getRoles().add(role);
        Administrateur cree = administrateurRepository.save(admin);
        audit.log("ADMIN_CREE", "Utilisateur", cree.getId(), type + " " + cree.getEmail());
        return AdminResponse.from(cree);
    }
}