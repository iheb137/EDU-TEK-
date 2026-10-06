package tn.tekup.edutek.dto;

import tn.tekup.edutek.entity.DocumentGenere;

import java.time.LocalDateTime;

public record DocumentGenereDto(Long id, String type, String url, LocalDateTime dateGeneration) {
    public static DocumentGenereDto from(DocumentGenere d) {
        return new DocumentGenereDto(d.getId(), d.getType(), d.getUrl(), d.getDateGeneration());
    }
}