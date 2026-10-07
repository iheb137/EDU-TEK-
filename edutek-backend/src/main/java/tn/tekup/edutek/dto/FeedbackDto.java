package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.FeedbackPrediction;

import java.time.LocalDateTime;

public record FeedbackDto(Long id, Long predictionId, Long auteurId, boolean pertinent,
                          String commentaire, LocalDateTime dateAvis) {
    public static FeedbackDto from(FeedbackPrediction f) {
        return new FeedbackDto(f.getId(), f.getPrediction().getId(), f.getAuteur().getId(),
                Boolean.TRUE.equals(f.getPertinent()), f.getCommentaire(), f.getDateAvis());
    }
}