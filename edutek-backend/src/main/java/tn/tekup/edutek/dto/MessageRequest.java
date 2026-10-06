package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record MessageRequest(
        @NotNull Long destinataireId,
        @NotBlank @Size(max = 255) String objet,
        @NotBlank @Size(max = 2000) String contenu
) {}