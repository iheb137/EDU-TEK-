package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ModeleRequest(
        @NotBlank @Size(max = 100) String nom,
        @NotBlank @Size(max = 50) String version,
        @NotBlank String type
) {}