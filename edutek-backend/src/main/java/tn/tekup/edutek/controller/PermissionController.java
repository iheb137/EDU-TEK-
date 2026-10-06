package tn.tekup.edutek.controller;

import tn.tekup.edutek.dto.PermissionDto;
import tn.tekup.edutek.entity.Permission;
import tn.tekup.edutek.repository.PermissionRepository;
import tn.tekup.edutek.repository.RoleRepository;
import tn.tekup.edutek.service.AuditService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Sort;
import org.springframework.http.HttpStatus;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;

@RestController
@RequestMapping("/api/permissions")
@RequiredArgsConstructor
@PreAuthorize("hasRole('SUPERADMIN')")
public class PermissionController {

    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;
    private final AuditService audit;

    @GetMapping
    public List<PermissionDto> lister() {
        return permissionRepository.findAll(Sort.by("code")).stream().map(PermissionDto::from).toList();
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PermissionDto creer(@Valid @RequestBody PermissionDto dto) {
        if (permissionRepository.existsByCode(dto.code())) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Permission deja existante : " + dto.code());
        }
        Permission p = new Permission();
        p.setCode(dto.code());
        p.setDescription(dto.description());
        Permission saved = permissionRepository.save(p);
        audit.log("PERMISSION_CREEE", "Permission", saved.getId(), saved.getCode());
        return PermissionDto.from(saved);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void supprimer(@PathVariable Long id) {
        Permission p = permissionRepository.findById(id).orElseThrow(() ->
                new ResponseStatusException(HttpStatus.NOT_FOUND, "Permission introuvable : " + id));
        if (roleRepository.existsByPermissionsId(id)) {
            throw new ResponseStatusException(HttpStatus.CONFLICT, "Permission encore attribuee a un role");
        }
        permissionRepository.delete(p);
        audit.log("PERMISSION_SUPPRIMEE", "Permission", id, p.getCode());
    }
}