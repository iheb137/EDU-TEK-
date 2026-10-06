package tn.tekup.edutek.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record RejetRequest(@NotBlank @Size(max = 255) String motif) {}