package tn.tekup.edutek.dto;

import java.util.List;

public record EvaluationResultDto(Long semestreId, Long classeId, double seuil, String avertissement,
                                  List<EvaluationModeleDto> modeles) {}