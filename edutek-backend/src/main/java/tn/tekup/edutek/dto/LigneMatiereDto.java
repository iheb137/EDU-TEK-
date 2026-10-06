package tn.tekup.edutek.dto;

public record LigneMatiereDto(
        Long matiereId,
        String code,
        String nom,
        Double coefficient,
        Integer credits,
        Double moyenne,
        boolean valide
) {}