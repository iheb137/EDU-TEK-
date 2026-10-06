package tn.tekup.edutek.dto;

import java.util.List;

public record BulletinDto(
        Long semestreId,
        String semestreNom,
        Long etudiantId,
        Double moyenne,
        Integer creditsObtenus,
        String decision,
        List<LigneMatiereDto> matieres
) {}