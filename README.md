<div align="center">

# 🎓 Edu-Tek

**Plateforme de suivi et d'accompagnement académique intégrant l'intelligence artificielle**

Projet semestriel · 5ᵉ année Génie Logiciel et Systèmes d'Information (GLSI) · TEK-UP University · 2026 – 2027

![Angular](https://img.shields.io/badge/Angular-21-DD0031?logo=angular&logoColor=white)
![Spring Boot](https://img.shields.io/badge/Spring%20Boot-4-6DB33F?logo=springboot&logoColor=white)
![Java](https://img.shields.io/badge/Java-17-007396?logo=openjdk&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-PyTorch-009688?logo=fastapi&logoColor=white)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-16-336791?logo=postgresql&logoColor=white)
![Kubernetes](https://img.shields.io/badge/Kubernetes-minikube-326CE5?logo=kubernetes&logoColor=white)
![Argo CD](https://img.shields.io/badge/GitOps-Argo%20CD-EF7B4D?logo=argo&logoColor=white)
![n8n](https://img.shields.io/badge/n8n-automatisation-EA4B71?logo=n8n&logoColor=white)
![CI](https://github.com/iheb137/EDU-TEK-/actions/workflows/ci.yml/badge.svg)

</div>

---

## 📌 Présentation

**Edu-Tek** centralise la vie académique d'un établissement et exploite ses données pour **repérer tôt les étudiants en difficulté**.

| Module | Ce qu'il permet |
|---|---|
| 🗂️ **Organisation pédagogique** | formations, semestres, matières, classes, affectation des enseignants, supports de cours |
| 🕒 **Assiduité et pointage** | appel des séances — l'appel **vaut déclaration des heures** de l'enseignant ; justificatifs d'absence |
| 📝 **Évaluations et résultats** | saisie ou import CSV des notes, clôture, calcul selon le règlement des études, bulletins |
| 📨 **Démarches et communication** | demandes de documents, stages, messagerie, actualités, annonces ciblées, notifications |
| 💰 **Rémunération** | tarifs horaires, contrôle des pointages, états de paiement mensuels |
| 🧠 **IA et accompagnement** | prédiction du risque d'échec (GRU calibré), facteurs explicatifs, alertes, actions d'accompagnement |
| 🛡️ **Gouvernance** | journal d'audit, supervision des traitements automatisés |

> **L'IA alerte, l'humain décide** : le responsable pédagogique valide chaque action ; l'étudiant ne reçoit que des recommandations bienveillantes, jamais son score.

---

## 🏗️ Architecture

```
                 ┌────────────────────────────── Kubernetes · namespace edutek ──────────────────────────────┐
 Navigateur ──►  │  Ingress NGINX ──► front (Angular + nginx, ×2) ──/api──► backend (Spring Boot, JWT)      │
 localhost       │                                                            │        │        ▲           │
 n8n.localhost   │                                                            ▼        ▼        │ API n8n   │
                 │                                                     PostgreSQL   ia (FastAPI · GRU)       │
                 │                                                    (StatefulSet)                 n8n ──► Gmail
                 └────────────────────────────────────────────────────────────────────────────────────────────┘
```

| Composant | Technologies | Port |
|---|---|---|
| `edutek-front` | Angular 21, servi par nginx (proxy `/api`) | 4200 (dev) · 8080 (conteneur) |
| `edutek-backend` | Spring Boot 4, Java 17, Spring Security + JWT, Hibernate, multi-établissement | 8080 |
| `edutek-ia` | Python 3.12, FastAPI, PyTorch (GRU), scikit-learn | 8000 |
| Base de données | PostgreSQL 16 | 5432 |
| Automatisation | n8n 2.29 (notifications e-mail par Gmail) | 5678 |

---

## 📁 Structure du dépôt

```
EDU-TEK-/
├── edutek-backend/          # API REST Spring Boot (+ Dockerfile, migrations SQL dans db/)
├── edutek-front/            # Application Angular (+ Dockerfile nginx)
├── edutek-ia/               # Service de prédiction FastAPI + PyTorch (+ Dockerfile)
├── k8s/                     # Manifestes Kubernetes (Kustomize)
│   ├── 00-namespace.yaml
│   ├── 10-postgres.yaml     # StatefulSet + volume persistant
│   ├── 20-backend.yaml      # ConfigMap, PVC, Deployment, Service
│   ├── 30-ia.yaml
│   ├── 40-front.yaml        # 2 réplicas + Ingress
│   ├── 50-smoke-tests.yaml  # Job PostSync (tests de fumée)
│   ├── 60-n8n.yaml          # n8n + Ingress n8n.localhost
│   └── kustomization.yaml   # étiquettes des images (mises à jour par la CI)
├── argocd/
│   └── edutek-app.yaml      # Application Argo CD (sync auto, prune, selfHeal)
├── docs/
│   ├── contrat-service-ia.md
│   └── integration-n8n.md
└── .github/workflows/ci.yml # Pipeline CI/CD
```

---

## 🚀 Démarrage en local (développement)

### Prérequis
- **Java 17**, **Node.js 22**, **Python 3.12**, **PostgreSQL 16** (ou Docker)

### 1. Base de données
```bash
docker run -d --name edutek-db -p 5432:5432 \
  -e POSTGRES_DB=edutek_db -e POSTGRES_USER=edutek -e POSTGRES_PASSWORD=<mot_de_passe> \
  postgres:16
```

### 2. Backend
```bash
cd edutek-backend
cp secrets.properties.example secrets.properties   # puis remplir les valeurs (fichier ignoré par Git)
./mvnw spring-boot:run                              # http://localhost:8080
```

### 3. Service IA
```bash
cd edutek-ia
python -m venv .venv && source .venv/bin/activate   # Windows : .venv\Scripts\activate
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-dev.txt
python -m app.train --source plan --etudiants 5000 --graine 42 --activer   # entraîne et active un modèle
uvicorn app.main:app --port 8000
```

### 4. Frontend
```bash
cd edutek-front
npm install
npm start                                           # http://localhost:4200 (proxy /api → :8080)
```

---

## ☸️ Déploiement sur Kubernetes (minikube)

```bash
minikube start --memory=6g --cpus=4
minikube addons enable ingress

# Secrets : créés directement dans le cluster, jamais dans Git
kubectl apply -f k8s/00-namespace.yaml
kubectl -n edutek create secret generic edutek-db \
  --from-literal=POSTGRES_DB=edutek_db --from-literal=POSTGRES_USER=edutek --from-literal=POSTGRES_PASSWORD=<...>
kubectl -n edutek create secret generic edutek-app \
  --from-literal=JWT_SECRET=<64+ caractères> \
  --from-literal=APP_SEED_ADMIN_PASSWORD=<...> --from-literal=APP_SEED_PLATEFORME_PASSWORD=<...> \
  --from-literal=APP_IA_APIKEY=<clé IA> --from-literal=APP_N8N_APIKEYS=<clé n8n, 32+ caractères>
kubectl -n edutek create secret generic edutek-ia  --from-literal=IA_API_KEY=<clé IA>
kubectl -n edutek create secret generic edutek-n8n --from-literal=N8N_ENCRYPTION_KEY=<...>

# Déploiement GitOps avec Argo CD
kubectl create namespace argocd
kubectl apply -n argocd -f https://raw.githubusercontent.com/argoproj/argo-cd/stable/manifests/install.yaml
kubectl apply -f argocd/edutek-app.yaml

minikube tunnel        # dans un second terminal
```

| Service | URL |
|---|---|
| Application | http://localhost |
| n8n | http://n8n.localhost |

```bash
kubectl get pods -n edutek               # tous Running, smoke-tests Completed
kubectl logs job/smoke-tests -n edutek   # SMOKE TESTS : 7/7 OK
```

---

## 🔄 Chaîne CI/CD/CT

```
 push sur main
   │
   ├─ CI  ─ gitleaks (secrets) ─ Maven + JUnit ─ ng build ─ pytest          (en parallèle)
   │        └─► images ×3 : build ─► Trivy (bloque toute faille CRITIQUE corrigeable) ─► ghcr.io
   │
   ├─ CD  ─ la CI écrit la nouvelle étiquette sha-xxxxxxx dans k8s/kustomization.yaml ([skip ci])
   │        └─► Argo CD détecte le commit ─► mise à jour progressive, sans interruption
   │
   └─ CT  ─ Job PostSync « smoke-tests » : 7 vérifications sur l'application déployée
```

- **Git est la source de vérité** : la CI n'a aucun accès au cluster ; revenir en arrière = `git revert`.
- **Images** : `ghcr.io/iheb137/edutek-{front,backend,ia}:sha-<commit>`.
- **Self-heal** : toute modification manuelle du cluster est annulée par Argo CD.

---

## 🧠 Modèle d'intelligence artificielle

| | |
|---|---|
| **Entrée** | 7 indicateurs par semestre (moyenne, crédits, matières non validées, séances pointées, taux d'absence, taux d'absence non justifiée, tendance) sur 5 semestres |
| **Réseau** | projection → GRU (48 unités) → connexion directe → tête à 2 couches · ≈ 14 500 paramètres |
| **Sortie** | probabilité calibrée (mise à l'échelle de température) + facteurs explicatifs (occlusion) |

| Modèle (test, données synthétiques) | AUC | PR-AUC | Brier | ECE |
|---|---|---|---|---|
| **GRU (retenu)** | **0,944** | **0,909** | **0,091** | **0,010** |
| Régression logistique | 0,940 | 0,905 | 0,094 | 0,013 |
| Règles manuelles | 0,896 | 0,847 | 0,144 | 0,130 |

> ⚠️ Le modèle est entraîné sur des **données synthétiques** générées à partir du plan d'études GLSI : il s'appelle `gru-risque-synth` pour que ce soit impossible à oublier. Détails : [`edutek-ia/README.md`](edutek-ia/README.md).

---

## 🤖 Automatisation avec n8n

Workflow **« Notifications par e-mail »**, toutes les 5 minutes :
récupération des notifications en attente → envoi par Gmail → marquage comme envoyées (jamais deux fois) → journalisation de l'exécution dans Edu-Tek.
Détails : [`docs/integration-n8n.md`](docs/integration-n8n.md).

---

## 🔐 Sécurité

- Authentification **JWT**, contrôle d'accès par **rôle**, limitation des tentatives de connexion
- **Isolation par établissement** (multi-tenant) sur toutes les requêtes
- **Aucun secret dans le dépôt** : `secrets.properties`, `.env` et données réelles sont ignorés par Git ; scan **gitleaks** à chaque push
- Images **non-root**, analysées par **Trivy** avant publication
- **Journal d'audit** des actions sensibles

---

## 🧪 Tests

| Étape | Outil | Résultat |
|---|---|---|
| Service IA | pytest | 16 / 16 |
| Backend | JUnit (démarrage complet sur PostgreSQL) | 1 / 1 |
| Frontend | build de production | ✔ |
| Sécurité | gitleaks + Trivy | ✔ |
| Après déploiement | Job smoke-tests | 7 / 7 |

---

## 👥 Équipe

| | |
|---|---|
| **Iheb Eddine SAAFI** | [GitHub](https://github.com/iheb137) · [LinkedIn](https://linkedin.com/in/saafi-iheb) |
| **Arbi HAZBRI** | |

Encadré par **M. Oussema Mansouri** — TEK-UP University.

<div align="center">

*Projet académique réalisé dans le cadre du cycle ingénieur GLSI — TEK-UP University, 2026 – 2027.*

</div>
