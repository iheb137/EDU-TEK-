package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;

public record DemandeDocumentRequest(@NotBlank String typeDocument) {}