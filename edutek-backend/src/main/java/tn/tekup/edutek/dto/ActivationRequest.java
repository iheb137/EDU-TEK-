package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;

public record ActivationRequest(@NotNull Boolean actif) {}