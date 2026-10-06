package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Permission;
import tn.tekup.edutek.entity.Role;
import tn.tekup.edutek.security.RolesSysteme;

import java.util.List;

public record RoleDto(Long id, String nom, boolean systeme, List<String> permissions) {
    public static RoleDto from(Role r) {
        return new RoleDto(r.getId(), r.getNom(), RolesSysteme.NOMS.contains(r.getNom()),
                r.getPermissions().stream().map(Permission::getCode).sorted().toList());
    }
}