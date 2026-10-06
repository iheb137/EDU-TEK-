package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record AnomalieRequest(@NotBlank @Size(max = 500) String commentaire) {}