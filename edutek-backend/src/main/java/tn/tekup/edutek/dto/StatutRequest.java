package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;

public record StatutRequest(@NotBlank String statut) {}