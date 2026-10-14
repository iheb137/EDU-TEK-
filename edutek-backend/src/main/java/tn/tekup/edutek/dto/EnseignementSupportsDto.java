package tn.tekup.edutek.dto;

import java.time.LocalDateTime;

/** Un enseignement et le nombre de supports de cours qui lui sont rattaches. */
public record EnseignementSupportsDto(
        Long enseignementId,
        String matiereCode,
        String matiereNom,
        Long classeId,
        String classeNom,
        String enseignantNom,
        Long semestreId,
        String semestreNom,
        long supports,
        long visibles,
        LocalDateTime dernierDepot
) {}
