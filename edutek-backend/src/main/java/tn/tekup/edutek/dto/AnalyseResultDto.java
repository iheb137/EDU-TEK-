package tn.tekup.edutek.dto;

import java.util.List;

public record AnalyseResultDto(Long semestreId, int analyses, int alertesCreees,
                               List<PredictionDto> predictions, List<String> avertissements) {}