package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record SupportLienRequest(
        @NotBlank @Size(max = 200) String titre,
        @Size(max = 120) String chapitre,
        @NotBlank @Size(max = 500)
        @Pattern(regexp = "^https?://\\S+$", message = "adresse http(s) valide obligatoire") String url,
        Boolean visible
) {}
