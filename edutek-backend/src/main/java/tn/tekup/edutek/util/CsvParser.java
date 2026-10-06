package tn.tekup.edutek.util;

import java.nio.ByteBuffer;
import java.nio.charset.CharacterCodingException;
import java.nio.charset.CodingErrorAction;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;

public final class CsvParser {

    public static class CsvException extends RuntimeException {
        public CsvException(String message) {
            super(message);
        }
    }

    private CsvParser() {}

    /** Decode du UTF-8 strict (refuse le Windows-1252) et retire le BOM ajoute par Excel. */
    public static String decoder(byte[] octets) {
        String texte;
        try {
            texte = StandardCharsets.UTF_8.newDecoder()
                    .onMalformedInput(CodingErrorAction.REPORT)
                    .onUnmappableCharacter(CodingErrorAction.REPORT)
                    .decode(ByteBuffer.wrap(octets)).toString();
        } catch (CharacterCodingException e) {
            throw new CsvException("Encodage invalide : enregistrez le fichier en CSV UTF-8");
        }
        if (!texte.isEmpty() && texte.charAt(0) == '\uFEFF') {
            texte = texte.substring(1);
        }
        return texte;
    }

    /** Point-virgule (Excel francais) ou virgule, d'apres l'en-tete. */
    public static char separateur(String texte) {
        int fin = 0;
        while (fin < texte.length() && texte.charAt(fin) != '\n' && texte.charAt(fin) != '\r') {
            fin++;
        }
        String entete = texte.substring(0, fin);
        long pointsVirgules = entete.chars().filter(c -> c == ';').count();
        long virgules = entete.chars().filter(c -> c == ',').count();
        return pointsVirgules > virgules ? ';' : ',';
    }

    /** Analyse un CSV (guillemets, guillemets doubles, retours a la ligne dans un champ). Lignes vides ignorees. */
    public static List<List<String>> analyser(String texte) {
        char sep = separateur(texte);
        List<List<String>> lignes = new ArrayList<>();
        List<String> champs = new ArrayList<>();
        StringBuilder sb = new StringBuilder();
        boolean guillemets = false;
        int n = texte.length();

        for (int i = 0; i < n; i++) {
            char c = texte.charAt(i);
            if (guillemets) {
                if (c == '"') {
                    if (i + 1 < n && texte.charAt(i + 1) == '"') {
                        sb.append('"');
                        i++;
                    } else {
                        guillemets = false;
                    }
                } else {
                    sb.append(c);
                }
            } else if (c == '"') {
                guillemets = true;
            } else if (c == sep) {
                champs.add(sb.toString());
                sb.setLength(0);
            } else if (c == '\n' || c == '\r') {
                if (c == '\r' && i + 1 < n && texte.charAt(i + 1) == '\n') {
                    i++;
                }
                champs.add(sb.toString());
                sb.setLength(0);
                ajouter(lignes, champs);
                champs = new ArrayList<>();
            } else {
                sb.append(c);
            }
        }
        if (guillemets) {
            throw new CsvException("Guillemet non ferme dans le fichier");
        }
        if (sb.length() > 0 || !champs.isEmpty()) {
            champs.add(sb.toString());
            ajouter(lignes, champs);
        }
        return lignes;
    }

    private static void ajouter(List<List<String>> lignes, List<String> champs) {
        boolean vide = champs.stream().allMatch(String::isBlank);
        if (!vide) {
            lignes.add(champs);
        }
    }
}