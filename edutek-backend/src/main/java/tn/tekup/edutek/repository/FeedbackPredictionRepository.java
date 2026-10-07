package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.FeedbackPrediction;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FeedbackPredictionRepository extends JpaRepository<FeedbackPrediction, Long> {
    List<FeedbackPrediction> findByPredictionIdOrderByDateAvisDescIdDesc(Long predictionId);
}