package tn.tekup.edutek.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.PathResource;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.util.EtablissementContexte;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.Locale;
import java.util.Map;
import java.util.UUID;

/**
 * Stockage des fichiers televerses sur le disque du serveur, un sous-dossier par etablissement.
 * Le nom stocke est aleatoire : le nom d'origine n'est jamais utilise comme chemin.
 */
@Service
public class StockageFichiersService {

    /** Extensions acceptees et type MIME servi au telechargement. */
    private static final Map<String, String> TYPES = Map.ofEntries(
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("odt", "application/vnd.oasis.opendocument.text"),
            Map.entry("odp", "application/vnd.oasis.opendocument.presentation"),
            Map.entry("txt", "text/plain"),
            Map.entry("zip", "application/zip"),
            Map.entry("png", "image/png"),
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"));

    private final Path racine;
    private final long tailleMax;

    public StockageFichiersService(@Value("${app.stockage.dossier:uploads}") String dossier,
                                   @Value("${app.stockage.taille-max-mo:20}") long tailleMaxMo) {
        this.racine = Path.of(dossier).toAbsolutePath().normalize();
        this.tailleMax = tailleMaxMo * 1024 * 1024;
    }

    public record FichierStocke(String chemin, String nomOrigine, String typeMime, long taille) {}

    public FichierStocke enregistrer(MultipartFile fichier, String categorie) {
        if (fichier == null || fichier.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Fichier vide ou absent");
        }
        if (fichier.getSize() > tailleMax) {
            throw new ResponseStatusException(HttpStatus.PAYLOAD_TOO_LARGE,
                    "Fichier trop volumineux : " + (tailleMax / 1024 / 1024) + " Mo maximum");
        }
        String nom = nettoyer(fichier.getOriginalFilename());
        String extension = extension(nom);
        String type = TYPES.get(extension);
        if (type == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "Format non accepte. Formats autorises : " + String.join(", ", TYPES.keySet().stream().sorted().toList()));
        }
        String relatif = etablissement() + "/" + categorie + "/" + UUID.randomUUID() + "." + extension;
        Path cible = resoudre(relatif);
        try (InputStream in = fichier.getInputStream()) {
            Files.createDirectories(cible.getParent());
            Files.copy(in, cible, StandardCopyOption.REPLACE_EXISTING);
        } catch (IOException e) {
            throw new ResponseStatusException(HttpStatus.INTERNAL_SERVER_ERROR, "Enregistrement du fichier impossible");
        }
        return new FichierStocke(relatif, nom, type, fichier.getSize());
    }

    public Resource lire(String relatif) {
        Path p = resoudre(relatif);
        if (!Files.isReadable(p)) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Fichier introuvable sur le serveur");
        }
        return new PathResource(p);
    }

    public void supprimer(String relatif) {
        if (relatif == null) {
            return;
        }
        try {
            Files.deleteIfExists(resoudre(relatif));
        } catch (IOException ignored) {
            // un fichier orphelin sur le disque n'empeche pas la suppression de l'enregistrement
        }
    }

    /** Empeche toute sortie du dossier de stockage (../). */
    private Path resoudre(String relatif) {
        Path p = racine.resolve(relatif).normalize();
        if (!p.startsWith(racine)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Chemin de fichier invalide");
        }
        return p;
    }

    private static String etablissement() {
        String code = EtablissementContexte.courant();
        return code == null || code.isBlank() ? "commun" : code.replaceAll("[^A-Za-z0-9_-]", "_");
    }

    private static String nettoyer(String nom) {
        if (nom == null || nom.isBlank()) {
            return "document";
        }
        String court = nom.replace('\\', '/');
        court = court.substring(court.lastIndexOf('/') + 1).replaceAll("[\\p{Cntrl}\"]", "").trim();
        if (court.length() > 200) {
            String ext = extension(court);
            court = court.substring(0, 190) + (ext.isEmpty() ? "" : "." + ext);
        }
        return court.isEmpty() ? "document" : court;
    }

    private static String extension(String nom) {
        int i = nom.lastIndexOf('.');
        return i < 0 ? "" : nom.substring(i + 1).toLowerCase(Locale.ROOT);
    }
}
