package tn.tekup.edutek.dto;

import jakarta.validation.constraints.Size;

/** Document papier pret : consigne de retrait facultative (bureau, horaires...). */
public record PretRetraitRequest(@Size(max = 500) String message) {}
