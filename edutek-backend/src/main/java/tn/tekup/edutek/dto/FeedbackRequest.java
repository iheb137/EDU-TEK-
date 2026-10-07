package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record FeedbackRequest(@NotNull Boolean pertinent, @Size(max = 500) String commentaire) {}