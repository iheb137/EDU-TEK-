# Contrat du service d'IA (FastAPI)

Le backend Spring Boot appelle ce service pour estimer le risque academique d'un etudiant.
Etat actuel : seul un FAUX service a regles (`stub-regles`) existe cote backend ; ce document
decrit ce que le vrai service Python devra exposer.

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
  (pas de zero invente). Le service doit tolerer les absences.
- `historique` : indicateurs des semestres anterieurs, du plus ancien au plus recent
  (sequence utilisable par un modele recurrent LSTM/GRU). Peut etre vide.

Reponse :

    {
      "modele": { "nom": "lstm-risque", "version": "2026.10.1", "type": "DEEP_LEARNING" },
      "probabilite": 0.7312,
      "facteurs": [
        { "nom": "TAUX_ABSENCE", "valeur": 0.25, "contribution": 0.84 },
        { "nom": "MOYENNE_SEMESTRE", "valeur": 9.5, "contribution": 0.31 }
      ]
    }

- `probabilite` : entre 0 et 1, probabilite de ne pas valider le semestre.
- `facteurs` : explication de la prediction, tries par |contribution| decroissante ;
  contribution > 0 augmente le risque, < 0 le reduit.
- `modele.type` : `BASELINE`, `DEEP_LEARNING`, ... (le backend enregistre chaque couple nom + version).

## Autres routes prevues

- `GET /health` : etat du service.
- `GET /model` : modele actif (meme structure que `modele` ci-dessus).
- `POST /train` : declenche un reentrainement (lot 5b).

## Erreurs

Statuts HTTP habituels ; corps `{"erreur": "message"}`.