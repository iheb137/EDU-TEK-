package tn.tekup.edutek.dto;

import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ChangementMotDePasseRequest(
        @NotBlank @Email String email,
        @NotBlank String ancienMotDePasse,
        @NotBlank @Size(min = 8, max = 64) String nouveauMotDePasse
) {}