package tn.tekup.edutek.dto;

import java.util.List;

public record PageDto<T>(List<T> contenu, int page, int taille, long total, int pages) {}