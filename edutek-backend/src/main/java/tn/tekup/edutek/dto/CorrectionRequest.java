package tn.tekup.edutek.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record CorrectionRequest(
        @NotNull @Min(1) @Max(720) Integer minutes,
        @NotBlank @Size(max = 500) String commentaire
) {}