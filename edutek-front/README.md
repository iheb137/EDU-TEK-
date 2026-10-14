# Edu-Tek — Frontend (Angular 21)

Interface web de la plateforme Edu-Tek. Projet isolé, à côté de `edutek-backend` et `edutek-ia`.

## Prérequis
Node.js 20.19+ ou 22.12+ (`node -v`), npm.

## Démarrage
```powershell
npm install
npm start          # http://localhost:4200
```
Les appels `/api` sont redirigés vers le backend (`proxy.conf.json`, par défaut `http://localhost:8080`) : pas de CORS en développement.

## Structure
```
src/app/
  core/         configuration, plus tard : authentification, intercepteurs, gardes
  layout/       shell (menu horizontal + contenu + pied de page), header, footer
  pages/        connexion, tableau-de-bord, bientot (écrans à construire)
  shared/icon/  composant <app-icon> (Ionicons, SVG intégré, couleur = texte)
public/images/  logo, icônes d'application
```

## Personnalisation
- **Image de fond de la connexion** : copier la photo dans `public/images/fond-connexion.jpg`, puis dans `src/styles.scss` remplacer `--fond-connexion: none;` par `--fond-connexion: url('/images/fond-connexion.jpg');`.
- **Nouvelle icône** : l'ajouter dans `src/app/shared/icon/icons.ts` (catalogue : https://ionic.io/ionicons), puis `<app-icon nom="…" />`.
- **Couleurs** : jetons CSS en tête de `src/styles.scss`.

## État
Étape 1 : thème, mise en page, connexion (formulaire validé, non branché), tableau de bord avec valeurs d'exemple.
Étape 2 : connexion au backend (JWT, en-tête `X-Etablissement`), garde de routes, menu selon le rôle.
