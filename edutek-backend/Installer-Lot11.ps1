# Lot 11 : client HTTP du service d'IA (app.ia.mode=http). Ne change PAS le mode par defaut (stub).
# A lancer avec l'application ARRETEE.
$ErrorActionPreference = 'Stop'
Set-Location "C:\Users\saafi\edu-tek\edutek-backend"
$utf8 = New-Object System.Text.UTF8Encoding($false)
$base = "src\main\java\tn\tekup\edutek"
$ProgressPreference = 'SilentlyContinue'

function Write-Java($rel, $content) {
    $full = Join-Path (Get-Location) $rel
    New-Item -ItemType Directory -Force -Path (Split-Path $full -Parent) | Out-Null
    [System.IO.File]::WriteAllText($full, $content.TrimStart(), $utf8)
    Write-Host "OK        $rel" -ForegroundColor Green
}
function Patch($rel, $motif, $remplacement, $dejaMotif, $libelle) {
    $full = Join-Path (Get-Location) $rel
    $t = [System.IO.File]::ReadAllText($full)
    if ($dejaMotif -and [regex]::IsMatch($t, $dejaMotif)) { Write-Host "Deja      $libelle" -ForegroundColor DarkGray; return }
    if (-not [regex]::IsMatch($t, $motif)) { Write-Host "ECHEC     $libelle (motif introuvable dans $rel)" -ForegroundColor Red; return }
    $nouveau = [regex]::Replace($t, $motif, $remplacement, 'None')
    [System.IO.File]::WriteAllText($full, $nouveau, $utf8)
    Write-Host "OK        $libelle" -ForegroundColor Green
}

if (-not (Test-Path "$base\ia\ServiceIa.java")) { Write-Host "Backend introuvable : arret." -ForegroundColor Red; return }

Write-Java "$base\ia\ServiceIaHttp.java" @'
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
        HttpClient http = HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(3)).build();
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
'@

# Proprietes non secretes (le mode reste "stub" tant que vous ne le changez pas vous-meme).
$props = Join-Path (Get-Location) "src\main\resources\application.properties"
$txt = [System.IO.File]::ReadAllText($props)
if ($txt -notmatch '(?m)^app\.ia\.url=') {
    $bloc = "`r`n# Service d'IA (app.ia.mode=http pour l'utiliser ; la cle d'API va dans secrets.properties : app.ia.api-key)`r`n" +
            "app.ia.url=http://localhost:8000`r`napp.ia.timeout-ms=10000`r`napp.ia.timeout-entrainement-ms=300000`r`n" +
            "app.ia.entrainement.source=synthetic`r`napp.ia.entrainement.fichier=`r`n"
    [System.IO.File]::WriteAllText($props, $txt.TrimEnd() + "`r`n" + $bloc, $utf8)
    Write-Host "OK        application.properties : proprietes app.ia.*" -ForegroundColor Green
} else { Write-Host "Deja      application.properties : proprietes app.ia.*" -ForegroundColor DarkGray }

# Contrat mis a jour (dossier docs a la racine du depot).
$docs = Join-Path (Split-Path (Get-Location) -Parent) "docs"
if (Test-Path $docs) {
    $contrat = @'
# Contrat du service d'IA (FastAPI + PyTorch)

Le backend Spring Boot appelle ce service pour estimer le risque academique d'un etudiant.
Service : dossier `edutek-ia/`, port 8000. Cote backend : `app.ia.mode=http` (`ServiceIaHttp`), ou `stub` (faux service a regles).

Si la variable `IA_API_KEY` est definie cote service, toutes les routes sauf `/health` exigent l'en-tete `X-API-Key`
(cote backend : propriete `app.ia.api-key`, dans `secrets.properties`).

## POST /predict

Requete :

    {
      "etudiantId": 12,
      "semestreId": 3,
      "indicateurs": {
        "MOYENNE_SEMESTRE": 9.5,
        "CREDITS_OBTENUS": 4.0,
        "NB_MATIERES_NON_VALIDEES": 1.0,
        "NB_SEANCES_POINTEES": 24.0,
        "TAUX_ABSENCE": 0.25,
        "TAUX_ABSENCE_NON_JUSTIFIEE": 0.125,
        "TENDANCE_MOYENNE": -1.5
      },
      "historique": [
        { "semestreId": 2, "dateDebut": "2025-02-01",
          "indicateurs": { "MOYENNE_SEMESTRE": 11.0, "TAUX_ABSENCE": 0.1 } }
      ]
    }

- `indicateurs` : indicateurs du semestre analyse. Un indicateur sans donnee source est ABSENT
  (jamais un zero invente) : le modele le traite comme une donnee manquante. Les indicateurs inconnus sont ignores.
- `historique` : indicateurs des semestres anterieurs, du plus ancien au plus recent (les 4 derniers sont utilises).
  Peut etre vide.

Reponse :

    {
      "modele": { "nom": "gru-risque-synth", "version": "2026.10.1", "type": "DEEP_LEARNING", "donnees": "SYNTHETIQUE" },
      "probabilite": 0.7312,
      "facteurs": [
        { "nom": "MOYENNE_SEMESTRE", "valeur": 9.5, "contribution": 0.84 },
        { "nom": "HISTORIQUE_SEMESTRES", "valeur": 1.0, "contribution": -0.31 }
      ]
    }

- `probabilite` : entre 0 et 1, probabilite de ne pas valider le semestre (calibree).
- `facteurs` : tries par |contribution| decroissante. `contribution` = variation du log-odds du risque par rapport a un
  etudiant moyen sur cet indicateur ; > 0 augmente le risque, < 0 le reduit. `HISTORIQUE_SEMESTRES` mesure l'effet
  des semestres precedents (valeur = nombre de semestres utilises).
- `modele.type` : `DEEP_LEARNING` pour un modele entraine. `modele.donnees` : `SYNTHETIQUE` ou `REELLE`
  (champ supplementaire, ignore par le backend actuel). Un modele entraine sur donnees synthetiques porte le nom `gru-risque-synth`.

## Autres routes

| Route | Role |
|---|---|
| `GET /health` | Etat du service et modele actif (`statut` : `ok` ou `sans_modele`). Sans cle d'API. |
| `GET /model` | Modele actif (meme structure que `modele`). 503 si aucun modele actif. |
| `GET /models` | Tous les modeles du registre (version, provenance des donnees, AUC test, actif). |
| `POST /activate` | `{"nom": "...", "version": "..."}` : active un modele (404 inconnu, 409 incompatible). |
| `POST /train` | Entraine un nouveau modele SANS l'activer. Corps : `source` (`synthetic` ou `csv`), `etudiants`, `fichier` (CSV du dossier `data/`), `graine`, `epoques`. Reponse : `modele` + `metriques` de test. Appel synchrone (quelques dizaines de secondes). |

## Erreurs

Statuts HTTP habituels ; corps `{"erreur": "message"}` (400 requete invalide, 401 cle absente, 404 introuvable,
409 conflit ou entrainement deja en cours, 422 corps mal forme, 503 aucun modele actif).
'@
    [System.IO.File]::WriteAllText((Join-Path $docs "contrat-service-ia.md"), $contrat, $utf8)
    Write-Host "OK        docs\contrat-service-ia.md" -ForegroundColor Green
}

Write-Host ""
Write-Host "Lot 11 installe. Pour utiliser le vrai service :" -ForegroundColor Cyan
Write-Host "  1) demarrer le service IA (voir edutek-ia\README.md), 2) mettre app.ia.mode=http, 3) redemarrer le backend,"
Write-Host "  4) lancer .\Verifier-Lot11.ps1"
