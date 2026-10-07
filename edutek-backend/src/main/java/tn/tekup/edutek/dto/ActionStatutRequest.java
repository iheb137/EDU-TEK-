package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ActionStatutRequest(@NotBlank String statut, @Size(max = 1000) String description) {}