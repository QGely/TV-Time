# TV Time — suivi de séries auto-hébergé

Une application web à installer sur votre NAS (ou n'importe quel serveur Docker) qui reprend le principe de l'application TV Time :
suivre ses séries épisode par épisode, savoir quoi regarder ensuite, voir les prochaines diffusions dans un calendrier,
réagir aux épisodes et consulter ses statistiques de visionnage. Les films sont aussi pris en charge (liste à voir, vus, notes).

Les métadonnées (affiches, épisodes, dates de diffusion, distribution) proviennent de [The Movie Database (TMDB)](https://www.themoviedb.org/),
via une clé API gratuite. Toutes **vos** données (comptes, progression, historique) restent chez vous, dans une base SQLite.

## Fonctionnalités

- **Accueil « À regarder »** : vos séries en cours avec le prochain épisode à voir et un bouton pour le cocher en un clic.
- **Fiche série** : saisons dépliables, coche par épisode, « marquer la saison comme vue », « tout marquer comme vu »,
  clic droit sur un épisode pour cocher aussi tous les précédents, progression, prochain épisode diffusé, distribution, bande-annonce.
- **Réactions et notes** : emoji (👍 😂 🤯 ❤️ 😢 👎) et note sur 10 par épisode ou par film, date de visionnage modifiable.
- **Listes** : en cours, à jour, pas commencée, pour plus tard, arrêtée, favoris. Tri et filtre.
- **Calendrier** : vue agenda et vue mois des épisodes à venir (et récents) de vos séries.
- **Explorer** : recherche séries/films, tendances, populaires, diffusées en ce moment, recommandations basées sur votre liste.
- **Profil et statistiques** : temps passé (mois / jours / heures), épisodes et séries, activité sur 12 mois, genres préférés,
  jours de visionnage, top séries, badges, séries de jours consécutifs.
- **Multi-utilisateurs** : chaque membre du foyer a son compte et sa progression ; fil d'activité commun.
- **Mise à jour automatique** des séries suivies (nouveaux épisodes, dates) toutes les 6 h.
- Interface en français, responsive (barre de navigation en bas sur mobile), installable comme application web (PWA basique).

## Installation sur un NAS avec Docker

### 1. Obtenir une clé API TMDB (gratuite)

1. Créez un compte sur https://www.themoviedb.org/signup
2. Allez dans **Paramètres → API** et demandez une clé (usage personnel).
3. Copiez la **clé API (v3)** ou le **jeton d'accès en lecture (v4)** : les deux fonctionnent.

Vous pourrez la saisir directement dans l'application (Paramètres) après la création du compte admin,
ou la fournir via la variable d'environnement `TMDB_API_KEY`.

### 2. Lancer avec Docker Compose (Synology Container Manager, QNAP Container Station, Unraid, Portainer…)

Créez un dossier (par ex. `/volume1/docker/tvtime`) contenant ce fichier `docker-compose.yml` :

```yaml
services:
  tvtime:
    image: ghcr.io/qgely/tv-time:latest
    container_name: tvtime
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - TMDB_API_KEY=            # optionnel : sinon à saisir dans l'application
      - TMDB_LANGUAGE=fr-FR
      - REFRESH_HOURS=6
    volumes:
      - ./data:/data              # base de données SQLite
```

Puis démarrez le projet (Container Manager → Projet → Créer, ou en ligne de commande) :

```bash
docker compose up -d
```

Ouvrez `http://IP-DU-NAS:3000`. Le **premier compte créé devient administrateur** : il configure la clé TMDB,
la langue et peut ouvrir ou fermer les inscriptions pour les autres membres du foyer.

> L'image est publiée automatiquement sur GitHub Container Registry (amd64 et arm64) par le workflow `.github/workflows/docker.yml`.
> Si vous préférez construire l'image vous-même sur le NAS, remplacez `image:` par `build: .` après avoir cloné le dépôt.

### Construire l'image soi-même

```bash
git clone https://github.com/qgely/tv-time.git
cd tv-time
docker compose up -d --build
```

### Sauvegarde

Tout est dans le dossier `data/` (fichier `tvtime.db` + fichiers WAL). Sauvegardez ce dossier.

### Accès depuis l'extérieur

Placez l'application derrière votre reverse proxy habituel (Synology Reverse Proxy, Nginx Proxy Manager, Traefik, Caddy…)
avec HTTPS. L'application écoute sur le port 3000 en HTTP et fait confiance aux en-têtes du proxy.

## Variables d'environnement

| Variable          | Défaut   | Description                                                                 |
|-------------------|----------|-----------------------------------------------------------------------------|
| `PORT`            | `3000`   | Port d'écoute                                                               |
| `DATA_DIR`        | `/data`  | Dossier de la base SQLite                                                   |
| `TMDB_API_KEY`    | —        | Clé API TMDB. Si absente, elle est saisie dans l'application (Paramètres).  |
| `TMDB_LANGUAGE`   | `fr-FR`  | Langue des métadonnées (modifiable dans l'application si non définie ici)   |
| `REFRESH_HOURS`   | `6`      | Intervalle de mise à jour automatique des séries suivies                    |

## Développement local (sans Docker)

Prérequis : Node.js 22.

```bash
npm install            # installe "concurrently" pour lancer les deux parties
npm run install:all    # dépendances du serveur et du frontend
cp .env.example .env   # puis renseignez TMDB_API_KEY (ou faites-le dans l'application)
npm run dev            # API sur http://localhost:3000, frontend Vite sur http://localhost:5173
```

Pour un déploiement sans Docker : `npm run build` puis `npm start` (le serveur sert le frontend compilé depuis `web/dist`).

## Architecture

```
server/   API Node.js (Express 5) + SQLite (better-sqlite3), synchronisation TMDB, tâche de rafraîchissement
web/      Frontend React 19 + Vite, sans dépendance UI externe (CSS maison, thème sombre + jaune)
```

Principales routes de l'API (toutes sous `/api`, authentification par cookie de session) :

- `auth/*` : inscription, connexion, profil
- `discover/search`, `discover/list/:name`, `discover/recommendations`
- `shows/:id` (+ `follow`, `list`, `episodes/:id/watch`, `episodes/:id/reaction`, `seasons/:n/watch`, `watch-all`, `refresh`)
- `movies`, `movies/:id` (+ `watchlist`, `watched`, `reaction`)
- `library`, `library/home`, `library/calendar`
- `profile/stats`, `profile/feed`
- `settings` (admin) : clé TMDB, langue, inscriptions, utilisateurs, rafraîchissement manuel

## Crédits

Ce projet utilise l'API de TMDB mais n'est ni approuvé ni certifié par TMDB. Il n'est pas affilié à TV Time.
