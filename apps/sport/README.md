# Sport — carnet d'entraînement auto-hébergé

Application web (port 3001) pour suivre ses séances de sport à la maison ou en salle, seul ou en famille.

## Fonctionnalités

- **Bibliothèque de 97 exercices** en français : jambes, pectoraux, dos, épaules, bras, abdos, cardio, full body,
  étirements. Chaque fiche montre un **schéma du corps (face et dos) avec les muscles sollicités**, l'exécution pas à pas,
  un conseil et les erreurs fréquentes. Filtres par groupe, matériel (barre, haltères, poids du corps, élastique…) et
  muscle. Exercices personnalisés possibles.
- **9 programmes prêts à l'emploi** : full body débutant, push/pull/legs, haut/bas, maison sans matériel, haltères,
  perte de poids HIIT, abdos 10 min, mobilité, course à pied objectif 5 km. « Adopter » un programme crée vos routines.
- **Routines** : vos séances types (exercices, séries, répétitions, repos), à démarrer en un clic.
- **Séance en direct** : chronomètre, saisie des séries (poids, répétitions, durée ou distance), rappel de la dernière
  performance, **minuteur de repos** automatique avec vibration sur mobile, ajout d'exercices à la volée, résumé avec
  **records personnels** (charge max, 1RM estimé, reps, durée, distance).
- **Historique** avec grille d'activité, notes et ressenti par séance, « Refaire cette séance ».
- **Statistiques** : objectif hebdomadaire, séances et volume par semaine, muscles travaillés sur 30 jours, records par
  exercice, courbe de poids corporel, badges, classement du foyer.
- Espace disque restant du NAS dans la barre latérale ; multi-utilisateurs ; interface mobile, ordinateur et télé.

## Lancer

Avec le `docker-compose.yml` à la racine du dépôt (`docker compose up -d --build sport`), ou sans Docker depuis la
racine : `npm run install:sport`, `npm run build:sport`, `npm run start:sport`.

Données : `data/sport/sport.db` (SQLite). Variables : `PORT` (3001), `DATA_DIR` (`/data` dans Docker).

## Ajouter des exercices ou des programmes

- Exercices : fichiers JSON dans `server/src/data/exercises/` (tableau d'objets `id, name, category, equipment, type,
  unit, level, primary_muscles, secondary_muscles, instructions, tips, mistakes`). Muscles disponibles : `chest,
  front_delts, side_delts, rear_delts, biceps, triceps, forearms, abs, obliques, quads, hamstrings, glutes, calves, lats,
  traps, lower_back, upper_back, hip_flexors, adductors, abductors, neck`.
- Programmes : `server/src/data/programs/programs.json` (jours → exercices avec `exercise_id, sets, reps, rest_seconds`).

Redémarrez le serveur après modification.
