package tn.tekup.edutek.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record PointageRequest(
        @NotNull Long seanceId,
        @Min(1) @Max(720) Integer minutes,
        @Size(max = 500) String commentaire
) {}