package tn.tekup.edutek.dto;

import java.util.List;

public record ImportNotesResultDto(
        boolean simulation,
        int lignesLues,
        int lignesValides,
        int notesCreees,
        String statutDesNotes,
        List<ErreurImportDto> erreurs
) {}