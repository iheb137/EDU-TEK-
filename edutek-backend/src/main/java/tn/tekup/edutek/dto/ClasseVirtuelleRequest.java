package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDateTime;

public record ClasseVirtuelleRequest(
        @NotBlank String plateforme,
        @NotBlank @Size(max = 255)
        @Pattern(regexp = "^https?://\\S+$", message = "URL http(s) valide obligatoire") String lien,
        @Size(max = 255) String codeAcces,
        @NotNull LocalDateTime dateHeure,
        @NotNull Long enseignementId
) {}