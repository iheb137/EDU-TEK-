package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

public record LivraisonRequest(
        @NotBlank
        @Size(max = 255)
        @Pattern(regexp = "^https?://\\S+$", message = "URL http(s) valide obligatoire")
        String url
) {}