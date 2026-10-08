package tn.tekup.edutek.ia;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.client.JdkClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.ResourceAccessException;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;
import org.springframework.web.server.ResponseStatusException;
import tn.tekup.edutek.ia.ContratIa.DemandePrediction;
import tn.tekup.edutek.ia.ContratIa.FacteurIa;
import tn.tekup.edutek.ia.ContratIa.ModeleInfo;
import tn.tekup.edutek.ia.ContratIa.ReponsePrediction;

import java.net.http.HttpClient;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Client HTTP du vrai service d'IA (dossier edutek-ia, FastAPI + PyTorch).
 * Active avec app.ia.mode=http ; le contrat est decrit dans docs/contrat-service-ia.md.
 */
@Service
@ConditionalOnProperty(name = "app.ia.mode", havingValue = "http")
public class ServiceIaHttp implements ServiceIa {

    private static final Logger log = LoggerFactory.getLogger(ServiceIaHttp.class);
    private static final Pattern ERREUR = Pattern.compile("\"erreur\"\\s*:\\s*\"([^\"]*)\"");

    private final RestClient rapide;
    private final RestClient entrainement;
    private final String sourceEntrainement;
    private final String fichierEntrainement;

    public ServiceIaHttp(@Value("${app.ia.url:http://localhost:8000}") String url,
                         @Value("${app.ia.api-key:}") String cle,
                         @Value("${app.ia.timeout-ms:10000}") long timeoutMs,
                         @Value("${app.ia.timeout-entrainement-ms:300000}") long timeoutEntrainementMs,
                         @Value("${app.ia.entrainement.source:synthetic}") String sourceEntrainement,
                         @Value("${app.ia.entrainement.fichier:}") String fichierEntrainement) {
        this.rapide = construire(url, cle, timeoutMs);
        this.entrainement = construire(url, cle, timeoutEntrainementMs);
        this.sourceEntrainement = sourceEntrainement;
        this.fichierEntrainement = fichierEntrainement;
    }

    private static RestClient construire(String url, String cle, long timeoutMs) {
        HttpClient http = HttpClient.newBuilder().version(HttpClient.Version.HTTP_1_1).connectTimeout(Duration.ofSeconds(3)).build();
        JdkClientHttpRequestFactory fabrique = new JdkClientHttpRequestFactory(http);
        fabrique.setReadTimeout(Duration.ofMillis(timeoutMs));
        RestClient.Builder b = RestClient.builder().baseUrl(url).requestFactory(fabrique);
        if (cle != null && !cle.isBlank()) {
            b.defaultHeader("X-API-Key", cle);
        }
        return b.build();
    }

    @Override
    public ReponsePrediction predire(DemandePrediction demande) {
        ReponseHttp r = appeler(() -> rapide.post().uri("/predict")
                .contentType(MediaType.APPLICATION_JSON).body(demande).retrieve().body(ReponseHttp.class));
        if (r == null || r.modele() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse du service IA vide ou invalide");
        }
        List<FacteurIa> facteurs = r.facteurs() == null ? List.of() : r.facteurs().stream()
                .map(f -> new FacteurIa(f.nom(), f.valeur(), f.contribution())).toList();
        return new ReponsePrediction(info(r.modele()), r.probabilite(), facteurs);
    }

    @Override
    public ModeleInfo modeleActif() {
        ModeleHttp m = appeler(() -> rapide.get().uri("/model").retrieve().body(ModeleHttp.class));
        if (m == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse du service IA vide ou invalide");
        }
        return info(m);
    }

    @Override
    public void activer(String nom, String version) {
        appeler(() -> rapide.post().uri("/activate").contentType(MediaType.APPLICATION_JSON)
                .body(Map.of("nom", nom, "version", version)).retrieve().toBodilessEntity());
    }

    @Override
    public ModeleInfo reentrainer() {
        Map<String, Object> corps = new LinkedHashMap<>();
        corps.put("source", sourceEntrainement);
        if (fichierEntrainement != null && !fichierEntrainement.isBlank()) {
            corps.put("fichier", fichierEntrainement);
        }
        ReponseEntrainement r = appeler(() -> entrainement.post().uri("/train")
                .contentType(MediaType.APPLICATION_JSON).body(corps).retrieve().body(ReponseEntrainement.class));
        if (r == null || r.modele() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_GATEWAY, "Reponse du service IA vide ou invalide");
        }
        return info(r.modele());
    }

    private static ModeleInfo info(ModeleHttp m) {
        return new ModeleInfo(m.nom(), m.version(), m.type());
    }

    private <T> T appeler(Supplier<T> action) {
        try {
            return action.get();
        } catch (RestClientResponseException e) {
            int code = e.getStatusCode().value();
            Matcher m = ERREUR.matcher(e.getResponseBodyAsString());
            String detail = m.find() ? m.group(1) : "erreur " + code;
            log.warn("Service IA : HTTP {} - {}", code, detail);
            HttpStatus statut = switch (code) {
                case 400 -> HttpStatus.BAD_REQUEST;
                case 404 -> HttpStatus.NOT_FOUND;
                case 409 -> HttpStatus.CONFLICT;
                case 503 -> HttpStatus.SERVICE_UNAVAILABLE;
                default -> HttpStatus.BAD_GATEWAY;
            };
            throw new ResponseStatusException(statut, "Service IA : " + detail);
        } catch (ResourceAccessException e) {
            log.warn("Service IA injoignable : {}", e.getMessage());
            throw new ResponseStatusException(HttpStatus.SERVICE_UNAVAILABLE, "Service IA injoignable");
        }
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ModeleHttp(String nom, String version, String type) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record FacteurHttp(String nom, Double valeur, Double contribution) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReponseHttp(ModeleHttp modele, double probabilite, List<FacteurHttp> facteurs) {}

    @JsonIgnoreProperties(ignoreUnknown = true)
    public record ReponseEntrainement(ModeleHttp modele) {}
}