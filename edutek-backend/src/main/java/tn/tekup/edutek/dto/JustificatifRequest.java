package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record JustificatifRequest(
        @NotNull LocalDate dateDebut,
        @NotNull LocalDate dateFin,
        @NotBlank String motif,
        @Size(max = 500) String commentaire,
        @Size(max = 255) @Pattern(regexp = "^https?://\\S+$", message = "URL http(s) valide obligatoire") String pieceUrl
) {}