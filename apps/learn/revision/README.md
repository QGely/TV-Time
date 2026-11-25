# Mémento de révision LAPL(A) / PPL(A)

`LAPL-PPL-memento.pdf` résume les 9 matières de l'examen théorique avion (format DGAC depuis le 4 décembre 2023). Il est généré à partir des fichiers `chapters/u1.json` … `u9.json` :

```bash
cd apps/learn/revision
node build.mjs --check                 # vérifie le format des 9 chapitres
node build.mjs                         # génère LAPL-PPL-memento.pdf
node build.mjs --only u3 --png /tmp/p  # aperçu d'un seul chapitre + pages en PNG
```

Prérequis : Node 20+, Playwright avec Chromium (`npm i -g playwright && npx playwright install chromium`) et poppler (`pdftotext`, `pdftoppm`). Les polices (Barlow Condensed, Inter, JetBrains Mono, licence OFL) sont dans `fonts/`.

## Format d'un chapitre

```jsonc
{
  "unit": "u3",                                  // u1 … u9 (ordre des épreuves)
  "title": "Météorologie",
  "exam": { "questions": 20, "minutes": 30 },
  "pitch": "Une ou deux phrases : ce que couvre la matière et pourquoi elle compte.",
  "essentials": ["6 à 14 phrases « si tu ne retiens que ça »"],
  "sections": [
    { "title": "Atmosphère et calages", "summary": "Une phrase de résumé (facultatif)", "blocks": [ /* blocs ci-dessous */ ] }
  ],
  "key_numbers": [{ "value": "1013,25 hPa", "label": "pression ISA au niveau de la mer" }],   // ≥ 8
  "glossary":    [{ "term": "QNH", "def": "Calage donnant l'altitude au-dessus du niveau de la mer" }], // ≥ 10
  "self_test":   [{ "q": "Question courte ?", "a": "Réponse courte" }]                          // ≥ 8
}
```

Dans tous les textes : `**gras**`, `*italique*`, `` `code` `` et `\n` pour un retour à la ligne.

| type | champs | rendu |
|---|---|---|
| `text` | `text` | paragraphe |
| `bullets` | `items[]`, `title?` | liste à puces |
| `steps` | `items[]`, `title?` | étapes numérotées (procédures) |
| `table` | `columns[]`, `rows[][]`, `caption?`, `note?` | tableau |
| `compare` | `items[{title, points[]}]` (2 à 4) | cartes côte à côte (QNH / QFE / 1013…) |
| `formula` | `label`, `formula`, `example?` | formule (reprise dans l'annexe B) |
| `key` | `text`, `title?` | encadré bleu « À retenir » |
| `trap` | `text`, `title?` | encadré orange « Piège classique » |
| `memo` | `text`, `title?` | encadré vert « Astuce pour retenir » |
| `example` | `text`, `title?` | encadré violet « Exemple » / calcul résolu |
| `code` | `text`, `label?`, `decode?` | bloc sombre à chasse fixe (METAR, TAF…) avec décodage |
| `dialog` | `lines[{who, text}]`, `title?` | échange radio |
| `diagram` | `svg`, `title?`, `caption?` | schéma SVG (viewBox large, 600 à 720 unités) |
