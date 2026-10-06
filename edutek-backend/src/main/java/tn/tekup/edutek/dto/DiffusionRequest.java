package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record DiffusionRequest(
        @NotBlank String audience,
        Long classeId,
        @NotBlank @Size(max = 255) String titre,
        @NotBlank @Size(max = 1000) String contenu
) {}