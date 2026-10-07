package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record ActionRequest(@NotBlank String type, @NotBlank @Size(max = 1000) String description) {}