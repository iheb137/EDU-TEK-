package tn.tekup.edutek.dto;

import java.util.List;

public record ImportResultDto(
        boolean simulation,
        int lignesLues,
        int lignesValides,
        int comptesCrees,
        List<ErreurImportDto> erreurs,
        List<CompteImporteDto> comptes
) {}