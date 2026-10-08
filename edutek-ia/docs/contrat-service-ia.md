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
