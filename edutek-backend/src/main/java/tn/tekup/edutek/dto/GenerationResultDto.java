package tn.tekup.edutek.dto;

import java.util.List;

public record GenerationResultDto(String periode, List<PaiementDto> etats, List<String> avertissements) {}