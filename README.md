# Trois applications pour la maison : TV Time · Sport · Apprendre

Trois sites web indépendants, pensés pour tourner sur un NAS (ou un PC) avec Docker, chacun avec ses comptes, sa base de
données et son look. Toutes vos données restent chez vous.

| Application | Port | Ce qu'elle fait | Dossier |
|-------------|------|-----------------|---------|
| **TV Time** | 3000 | Suivi de séries et de films façon TV Time : épisode par épisode, calendrier, collections (MCU, Star Wars…), stats | [`apps/tvtime`](apps/tvtime) |
| **Sport** | 3001 | Carnet d'entraînement : 97 exercices avec schémas musculaires, programmes, routines, séances avec minuteur de repos, records, stats | [`apps/sport`](apps/sport) |
| **Apprendre** | 3002 | Apprentissage des langues avec un parcours façon Duolingo : unités, leçons, XP, cœurs, série, classement du foyer | [`apps/learn`](apps/learn) |

Chaque application a son propre README avec le détail des fonctionnalités.

## Installation avec Docker (NAS Synology, QNAP, Unraid, Portainer, PC)

1. Récupérez le dépôt (bouton « Code → Download ZIP » ou `git clone`).
2. Dans le dossier, lancez :

```bash
docker compose up -d --build
```

3. Ouvrez :
   - TV Time : `http://IP-DU-NAS:3000`
   - Sport : `http://IP-DU-NAS:3001`
   - Apprendre : `http://IP-DU-NAS:3002`

Sur chaque site, **le premier compte créé est administrateur**. Les autres membres du foyer créent ensuite leur compte
(l'admin peut fermer les inscriptions).

Pour TV Time, une clé API TMDB gratuite est nécessaire : voir [`apps/tvtime/README.md`](apps/tvtime/README.md).
Elle se saisit dans l'application, jamais dans le dépôt.

Vous n'utilisez qu'une ou deux applications ? Commentez les autres services dans `docker-compose.yml`.

Les images sont aussi publiées sur GitHub Container Registry (`ghcr.io/qgely/tv-time-tvtime`, `…-sport`, `…-learn`,
amd64 et arm64) : remplacez `build:` par `image:` dans le compose pour ne rien compiler sur le NAS.

### Sauvegarde

Tout est dans `data/` : `data/tvtime`, `data/sport`, `data/learn` (un fichier SQLite chacun). Sauvegardez ce dossier.

### Accès depuis l'extérieur

Placez les applications derrière votre reverse proxy habituel (HTTPS). Chaque application écoute en HTTP sur son port et
fait confiance aux en-têtes du proxy.

## Sans Docker (test sur un PC)

Prérequis : Node.js 22.

```bash
npm install            # outil pour lancer les trois serveurs ensemble
npm run install:all    # dépendances des trois applications
npm run build          # compile les trois interfaces
npm start              # lance TV Time (3000), Sport (3001) et Apprendre (3002)
```

Une seule application : `npm run install:sport`, `npm run build:sport`, `npm run start:sport` (idem `tvtime`, `learn`).
En développement : `npm run dev:learn` (API + rechargement à chaud).

## Structure

```
apps/
  tvtime/   server (Express + SQLite + TMDB) · web (React/Vite) · Dockerfile
  sport/    server (Express + SQLite, bibliothèque d'exercices et programmes en JSON) · web · Dockerfile
  learn/    server (Express + SQLite, cours en JSON, générateur de leçons) · web · Dockerfile
docker-compose.yml     les trois services
.github/workflows/     publication des trois images Docker
```

Les contenus (collections de séries, exercices, programmes, cours de langues) sont de simples fichiers JSON dans
`apps/*/server/src/data/`, faciles à compléter.
