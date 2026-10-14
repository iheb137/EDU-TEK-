# Edu-Tek IA

Service de prediction du **risque d'echec academique** d'un etudiant, en Python (FastAPI + PyTorch).
Dossier isole : il ne partage ni code ni base de donnees avec le backend Spring Boot, ils communiquent en HTTP
(contrat : `docs/contrat-service-ia.md`).

```
Backend Spring Boot (8080)  --POST /predict-->  Service IA (8000)  -->  modele PyTorch actif (models/)
 indicateurs calcules par le backend              probabilite + facteurs explicatifs
```

## Ce que fait le modele

Entree : les 7 indicateurs academiques du semestre en cours (moyenne, credits, matieres non validees, seances pointees,
taux d'absence, taux d'absence non justifiee, tendance de la moyenne) et ceux des **4 semestres precedents** au plus.
Sortie : la probabilite de **ne pas valider le semestre**, calibree, et les facteurs qui l'expliquent.

- **Donnees manquantes** : un indicateur absent est signale par un bit dedie, jamais remplace par un zero invente.
  L'entrainement masque aleatoirement 8 % des indicateurs pour que le modele reste fiable sur des donnees partielles.
- **Reseau** : projection par semestre, GRU (48 unites) qui lit la trajectoire, connexion directe vers les indicateurs
  du semestre courant, tete a 2 couches. Environ 12 000 parametres, entrainable sur CPU en quelques secondes.
- **Calibration** : mise a l'echelle de temperature ajustee sur la validation, pour que « 70 % » signifie environ 7 cas sur 10.
- **Explication** : par occlusion. Chaque indicateur present est remplace par la moyenne de la population et on mesure
  la variation du log-odds. Positif = augmente le risque. `HISTORIQUE_SEMESTRES` mesure l'effet des semestres precedents.

## Donnees : lire ceci avant tout

**Aujourd'hui, le modele est entraine sur des donnees SYNTHETIQUES** (`app/synthetic.py`) : des etudiants fabriques par un
generateur avec une aptitude, un engagement qui evolue et du bruit. Cela valide toute la chaine (donnees, entrainement,
evaluation, service, integration) mais **les metriques ne disent rien sur la performance reelle a TEK-UP** : le modele a
appris les regles du generateur. Pour que ce soit impossible a oublier, un tel modele s'appelle `gru-risque-synth`, porte
`donnees = SYNTHETIQUE` et le nom est visible dans le backend.

**Simulateur du plan d'etudes TEK-UP** (`--source plan`, `app/plan_etudes.py` + `app/simulateur_plan.py`) : meme nature
(donnees SYNTHETIQUES), mais la structure est celle du plan officiel GLSI 2024-2025, de S1 a S10 : modules, coefficients,
ECTS, volumes horaires, prerequis. La moyenne du semestre est la moyenne ponderee des modules, les absences et l'engagement
suivent un modele explicite, des etudiants abandonnent, les promotions sont observees a des dates differentes. Les parametres
(`Parametres` : niveau par semestre, difficulte par domaine, bruit, abandon) peuvent etre calees sur des statistiques reelles
**agregees** (taux de reussite par semestre) : le jeu produit `taux_echec_par_semestre` pour les comparer. Hypotheses a
connaitre : S10 = PFE lu sur le plan SSIR, paniers optionnels de S9 hors totaux, une seance pointee = un bloc de 10,5 h, ecart de
1 ECTS en S4 dans le document source. Le plan ne contient aucun resultat d'etudiant : ce jeu ne prouve rien sur la realite.

Pour passer en reel : exporter du backend un CSV **pseudonymise** (jamais matricule, nom ni e-mail), le placer dans `data/`
(ignore par Git) et lancer `python -m app.train --source csv --fichier data/export.csv`. Colonnes :
`etudiant_id; semestre_id; date_debut; echec; MOYENNE_SEMESTRE; CREDITS_OBTENUS; NB_MATIERES_NON_VALIDEES; NB_SEANCES_POINTEES; TAUX_ABSENCE; TAUX_ABSENCE_NON_JUSTIFIEE; TENDANCE_MOYENNE`
(valeur vide = absent, `echec` = 1 si le semestre n'est pas valide). Le modele reel s'appellera `gru-risque`.

## Entrainement

```powershell
python -m app.train --source synthetic --etudiants 5000 --graine 42 --activer
python -m app.train --source plan --etudiants 5000 --graine 42 --activer     # simulateur du plan d'etudes
```

La procedure : jeu de donnees, separation **par etudiant** (70/15/15, aucun etudiant dans deux ensembles), Adam avec
reduction du pas sur plateau, arret anticipe sur la perte de validation, meilleure epoque restauree, calibration,
evaluation sur le test, comparaison avec deux references **sur le meme test** :

| Modele (test synthetique, 3 368 echantillons) | AUC | PR-AUC | Brier | ECE |
|---|---|---|---|---|
| **GRU (ce service)** | 0,944 | 0,909 | 0,091 | 0,010 |
| Regression logistique (semestre courant seul) | 0,940 | 0,905 | 0,094 | 0,013 |
| Regles actuelles du backend (`stub-regles`) | 0,896 | 0,847 | 0,144 | 0,130 |

Lecture honnete : le reseau fait mieux que les regles manuelles (surtout en calibration), mais **ne bat la regression
logistique que de peu**. Sur ces donnees synthetiques, l'information utile est presque entierement dans le semestre
courant. L'apport reel d'un modele sequentiel ne pourra etre juge que sur des donnees reelles.

Chaque entrainement ecrit dans `models/<nom>/<version>/` : `weights.pt` et `meta.json` (architecture, echelles,
temperature, metriques, provenance des donnees, graine, versions). Versions : `AAAA.MM.N`.

## Installation (Windows, PowerShell)

```powershell
cd C:\Users\saafi\edu-tek\edutek-ia
py -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-dev.txt
python -m pytest -q                                   # 16 tests
python -m app.train --activer                         # entraine et active un modele
uvicorn app.main:app --port 8000                      # demarre le service
```

Documentation interactive : http://localhost:8000/docs. Variables : `IA_API_KEY` (cle partagee avec le backend),
`IA_MODELS_DIR`, `IA_DATA_DIR`, `IA_BOOTSTRAP=1` (entraine un modele synthetique au demarrage si aucun n'est actif,
developpement uniquement). Docker : `docker build -t edutek-ia .`

## Brancher le backend

Dans `application.properties` : `app.ia.mode=http` et `app.ia.url=http://localhost:8000`. Cle d'API : meme valeur dans
`IA_API_KEY` (service) et `app.ia.api-key` (`secrets.properties`). Le backend peut alors reentrainer
(`POST /api/ia/modeles/reentrainer`) puis mettre un modele en production (`PUT /api/ia/modeles/{id}/statut`).

## Limites connues (a discuter)

- Modele entraine sur donnees synthetiques : pas de valeur predictive demontree.
- Modele unique partage par tous les etablissements ; l'activation d'un modele s'applique a tous.
- Prediction faite en cours de semestre : la qualite depend de la fraicheur des notes et des presences.
- Aucune analyse d'equite (par groupe) ni surveillance de derive tant qu'il n'y a pas de donnees reelles.
- `MOYENNE_SEMESTRE` est supposee sur 20 ; une formation avec un autre bareme demandera une normalisation.
