# Integration n8n : guide

Le backend expose a n8n des points d'entree sous `/api/n8n/**`, proteges par une cle d'API.
Les workflows eux-memes se construisent dans n8n.

## Authentification

- En-tete `X-API-Key: <cle>` sur chaque requete (noeud « HTTP Request » de n8n, authentification
  « Header Auth », nom `X-API-Key`).
- La cle est dans `edutek-backend/secrets.properties` (`app.n8n.api-keys`), jamais dans Git.
- Rotation : ajouter la nouvelle cle apres l'ancienne, separees par une virgule, redemarrer le backend,
  mettre a jour n8n, puis retirer l'ancienne cle.
- La cle ne donne acces qu'a `/api/n8n/**`.

## Points d'entree

| Methode et chemin | Role |
|---|---|
| `GET /api/n8n/sante` | verifier la cle et la connexion |
| `POST /api/n8n/executions` | declarer une execution : `{"workflow":"nom","statut":"SUCCES|ECHEC|EN_COURS","idExterne":"id n8n","dureeMs":1200,"resultat":"texte"}` ; idempotent par (workflow, idExterne) ; un ECHEC cree une alerte technique |
| `POST /api/n8n/alertes-techniques` | signaler une alerte : `{"type":"...","niveau":"INFO|MOYEN|ELEVE|CRITIQUE","message":"...","source":"..."}` |
| `GET /api/n8n/workflows/{nom}/actif` | interrupteur : le workflow s'arrete s'il renvoie `false` |
| `POST /api/n8n/analyses?semestreId=1&classeId=2` | declencher l'analyse du risque (`etudiantId` ou `classeId`, ou toute la promotion) |
| `GET /api/n8n/notifications/a-envoyer?limite=50` | notifications non envoyees (1 a 200), avec email du destinataire |
| `POST /api/n8n/notifications/envoyees` | `{"ids":[1,2,3]}` (1 a 200) : marque comme envoyees, idempotent |
| `POST /api/n8n/notifications/amorcer` | a appeler UNE fois avant de brancher n8n : marque toutes les notifications en attente comme envoyees |

## Workflows conseilles

1. **Envoi des notifications** (toutes les minutes) : `a-envoyer` -> envoi de l'email -> `envoyees`.
2. **Rapport d'erreur** : declencheur « Error Trigger » -> `POST /executions` avec `statut = ECHEC`.
3. **Analyse hebdomadaire** : planification -> `POST /analyses?semestreId=...`.
4. **Interrupteur** : au debut de chaque workflow, `GET /workflows/{nom}/actif`.