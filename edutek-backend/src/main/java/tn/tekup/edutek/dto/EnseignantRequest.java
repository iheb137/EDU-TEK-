package tn.tekup.edutek.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record EnseignantRequest(
        @NotBlank String nom,
        @NotBlank String prenom,
        @NotBlank @Email String email,
        @Size(min = 8) String motDePasse,
        String telephone,
        @NotBlank String matricule,
        String specialite,
        String grade
) {}