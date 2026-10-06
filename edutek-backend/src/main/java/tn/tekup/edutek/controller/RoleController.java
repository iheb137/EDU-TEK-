package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.PermissionsRequest;
import tn.tekup.edutek.dto.RoleDto;
import tn.tekup.edutek.dto.RoleRequest;
import tn.tekup.edutek.entity.Permission;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.repository.PermissionRepository;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.security.RolesSysteme;
import tn.tekup.edutek.service.AuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/roles")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class RoleController {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final AuditService audit;

    @GetMapping
    @Transactional(readOnly = true)
    public List<RoleDto> lister() {
        return roleRepository.findAll(Sort.by("nom")).stream().map(RoleDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    @Transactional
    public RoleDto creer(@Valid @RequestBody RoleRequest req) {
        String nom = req.nom().trim().toUpperCase(Locale.ROOT);
        if (roleRepository.existsByNom(nom)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role deja existant : " + nom);
        }
        Role r = new Role();
        r.setNom(nom);
        r.setPermissions(chargerPermissions(req.permissions()));
        Role saved = roleRepository.save(r);
        audit.log("ROLE_CREE", "Role", saved.getId(), nom);
        return RoleDto.from(saved);
    }

    @PutMapping("/{id}/permissions")
    @Transactional
    public RoleDto definirPermissions(@PathVariable Long id, @Valid @RequestBody PermissionsRequest req) {
        Role r = trouver(id);
        r.setPermissions(chargerPermissions(req.permissions()));
        audit.log("ROLE_PERMISSIONS_MODIFIEES", "Role", id, r.getNom() + " -> " + req.permissions());
        return RoleDto.from(r);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        Role r = trouver(id);
        if (RolesSysteme.NOMS.contains(r.getNom())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Role systeme : suppression impossible");
        }
        roleRepository.delete(r);
        audit.log("ROLE_SUPPRIME", "Role", id, r.getNom());
    }

    private Role trouver(Long id) {
        return roleRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Role introuvable : " + id));
    }

    private List<Permission> chargerPermissions(List<String> codes) {
        if (codes == null || codes.isEmpty()) {
            return new ArrayList<>();
        }
        Set<String> demandes = codes.stream()
                .map(c -> c.trim().toUpperCase(Locale.ROOT))
                .collect(Collectors.toCollection(LinkedHashSet::new));
        List<Permission> trouvees = permissionRepository.findByCodeIn(demandes);
        if (trouvees.size() != demandes.size()) {
            Set<String> connus = trouvees.stream().map(Permission::getCode).collect(Collectors.toSet());
            demandes.removeAll(connus);
            throw new ResponseStatusException(HttpStatus.NOT_FOUND,
                    "Permission(s) introuvable(s) : " + String.join(", ", demandes));
        }
        return new ArrayList<>(trouvees);
    }
}