package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record StageRequest(
        @NotBlank @Size(max = 255) String entreprise,
        @NotBlank @Size(max = 255) String sujet,
        @NotNull LocalDate dateDebut,
        @NotNull LocalDate dateFin
) {}