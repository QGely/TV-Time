# Apprendre — langues avec un parcours façon Duolingo

Application web (port 3002) pour apprendre une langue quelques minutes par jour, avec le même principe de parcours que
Duolingo : des unités, des leçons à débloquer dans l'ordre, des niveaux, des XP, des cœurs et une série de jours.

## Fonctionnalités

- **Cours fournis** : anglais, espagnol, italien, allemand (6 unités × 4 leçons, ~290 mots et ~190 phrases chacun),
  pour francophones. Chaque leçon a un guide (grammaire, usage), son vocabulaire et ses phrases.
- **Préparation au théorique LAPL(A) / PPL(A)** : les 9 matières de l'examen DGAC (droit aérien, performance humaine,
  météorologie, communications, navigation, principes du vol, procédures opérationnelles, performances et préparation
  du vol, connaissance de l'aéronef) dans le même arbre, chaque matière débloquable directement. Chaque chapitre a une
  fiche de cours, un glossaire et une banque de QCM corrigés et expliqués (questions d'entraînement originales, pas
  les questions officielles).
- **Examen blanc** au format officiel : 128 questions tirées au hasard, chronométrées par matière (3 h 32 au total),
  navigation entre questions, questions marquées, correction côté serveur, seuil de 75 % **dans chaque matière**,
  corrigé détaillé, historique et meilleur score par matière. Entraînement possible matière par matière.
- **Bibliothèque de révision** : ressources françaises et anglaises (QCM gratuits, PDF, manuels, réglementation
  officielle, BIA) avec liens, accès gratuit/payant, filtres, et une checklist de programme prioritaire cochable.
- **Parcours** : nœuds colorés par unité, leçon active avec bulle « Commencer », leçons verrouillées jusqu'à la
  précédente, anneau de progression, couronne quand les 3 niveaux sont validés, bannière d'unité avec guide.
- **Leçons** de 10 à 12 exercices générés à partir du contenu : choix de traduction, association de paires, construction
  de phrase avec banque de mots, texte à trou, saisie de la traduction, dictée (lecture à voix haute par le navigateur).
  Les erreurs reviennent en fin de leçon. Tolérance aux fautes de frappe. Validation à 60 % de bonnes réponses.
- **Progression** : XP (+15 par leçon, +10 par révision, +5 si parfaite), niveau du profil, objectif quotidien
  (10/20/30/50 XP), série de jours avec gel possible, **cœurs** (5, un perdu par erreur, regagné en révisant ou toutes
  les 4 h), force des leçons qui baisse avec le temps (révisions ciblées sur les erreurs).
- **Révision** mixte ou par leçon, **classement du foyer** (XP de la semaine), profil avec 30 derniers jours et succès.
- Espace disque restant ; multi-utilisateurs ; thème clair avec mode sombre automatique ; mobile, ordinateur, télé.

## Lancer

Avec le `docker-compose.yml` à la racine du dépôt (`docker compose up -d --build learn`), ou sans Docker depuis la
racine : `npm run install:learn`, `npm run build:learn`, `npm run start:learn`.

Données : `data/learn/learn.db` (SQLite). Variables : `PORT` (3002), `DATA_DIR` (`/data` dans Docker).

## Ajouter un cours de type QCM (préparation d'examen)

Même principe, avec `"type": "quiz"` et des questions à la place des phrases :

```json
{ "id": "lapl", "type": "quiz", "title": "LAPL(A) / PPL(A)", "flag": "✈️", "unlock": "unit", "library": "lapl",
  "exam": { "pass_percent": 75, "subjects": [{ "unit": "u1", "title": "Droit aérien", "questions": 20, "minutes": 30 }] } }
```

et dans un fichier `lapl.part1.json` les unités, avec pour chaque leçon `tips` (fiche), `vocab` (glossaire, définitions
de 70 caractères maximum) et `questions` (`{ "id": "u1s1q01", "q": "…", "choices": ["…","…","…","…"], "answer": 0,
"explanation": "…" }`). `"unlock": "unit"` permet de commencer chaque matière indépendamment. Vérifiez les fichiers avec
`node server/scripts/validate-courses.mjs`. La bibliothèque est un fichier `server/src/data/libraries/<id>.json`.

## Ajouter un cours

Un cours est un ou plusieurs fichiers JSON dans `server/src/data/courses/` (`<id>.json` ou `<id>.part1.json`,
`<id>.part2.json`, fusionnés au chargement) :

```json
{
  "id": "pt", "title": "Portugais", "lang_name": "portugais", "flag": "🇵🇹", "tts_lang": "pt-PT",
  "description": "Une phrase.",
  "units": [{ "id": "u1", "title": "Les bases 1", "description": "…", "color": "#58cc02",
    "skills": [{ "id": "u1s1", "title": "Salutations", "icon": "👋", "tips": "Note de grammaire…",
      "vocab": [{ "term": "olá", "translation": "bonjour", "emoji": "👋" }],
      "sentences": [{ "source": "Olá, como estás?", "target": "Bonjour, comment vas-tu ?" }] }] }]
}
```

Il faut au moins 4 mots par leçon ; les exercices sont générés automatiquement. Le cours peut aussi être autre chose
qu'une langue (vocabulaire technique, capitales…) : `term` est la question, `translation` la réponse.
