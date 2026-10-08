package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AlerteTechniqueRequest(
        @NotBlank @Size(max = 100) String type,
        @NotBlank String niveau,
        @NotBlank @Size(max = 1000) String message,
        @Size(max = 100) String source
) {}