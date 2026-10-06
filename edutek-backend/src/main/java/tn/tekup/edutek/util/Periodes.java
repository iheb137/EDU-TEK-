package tn.tekup.edutek.util;

import org.springframework.http.HttpStatus;
import org.springframework.web.server.ResponseStatusException;

import java.time.YearMonth;
import java.time.format.DateTimeParseException;

public final class Periodes {

    private Periodes() {}

    public static YearMonth analyser(String periode) {
        if (periode == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Periode invalide : format AAAA-MM attendu");
        }
        try {
            return YearMonth.parse(periode.trim());
        } catch (DateTimeParseException e) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Periode invalide : format AAAA-MM attendu");
        }
    }
}