package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public record TarifRequest(
        @NotNull @Positive Double montant,
        @NotNull LocalDate dateDebut,
        @Size(max = 100) String grade
) {}