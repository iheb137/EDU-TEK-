package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;

public record ParametresRisqueRequest(@NotNull @Positive Double seuilMoyen, @NotNull @Positive Double seuilEleve) {}