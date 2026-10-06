package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.Permission;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record PermissionDto(
        Long id,
        @NotBlank @Pattern(regexp = "^[A-Z][A-Z0-9_]{2,59}$", message = "Code en MAJUSCULES : 3 a 60 caracteres (lettres, chiffres, underscore)") String code,
        @Size(max = 255) String description
) {
    public static PermissionDto from(Permission p) {
        return new PermissionDto(p.getId(), p.getCode(), p.getDescription());
    }
}