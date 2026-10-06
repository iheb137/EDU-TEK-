package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;

import java.util.List;

public record RoleRequest(
        @NotBlank @Pattern(regexp = "^[A-Za-z][A-Za-z0-9_]{2,49}$", message = "3 a 50 caracteres : lettres, chiffres, underscore") String nom,
        List<String> permissions
) {}