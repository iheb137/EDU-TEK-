package tn.tekup.edutek.repository;

import tn.tekup.edutek.entity.PredictionIA;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PredictionIARepository extends JpaRepository<PredictionIA, Long> {
    List<PredictionIA> findAllByOrderByDatePredictionDescIdDesc();
}