package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.PositiveOrZero;
import jakarta.validation.constraints.Size;

public record ExecutionRequest(
        @NotBlank @Size(max = 100) String workflow,
        @NotBlank String statut,
        @Size(max = 100) String idExterne,
        @PositiveOrZero Long dureeMs,
        @Size(max = 1000) String resultat
) {}