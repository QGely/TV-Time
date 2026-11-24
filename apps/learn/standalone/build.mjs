/**
 * Version web autonome de la révision LAPL(A)/PPL(A) (sans serveur).
 *   node build.mjs  → lapl-data.json (données) + Prepa-LAPL-PPL.html (fichier unique hors ligne, à ouvrir d'un double-clic)
 * app.html est la page publiée (artefact claude.ai) ; elle charge lapl-data.json, ou les données incluses dans le fichier hors ligne.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(HERE, '../server/src/data');
const meta = JSON.parse(fs.readFileSync(path.join(DATA, 'courses/lapl.json'), 'utf8'));
const units = [];
for (const f of fs.readdirSync(path.join(DATA, 'courses')).filter((f) => /^lapl\.part[\w-]+\.json$/.test(f)).sort()) {
  for (const u of JSON.parse(fs.readFileSync(path.join(DATA, 'courses', f), 'utf8')).units || []) {
    const ex = units.find((x) => x.id === u.id);
    if (!ex) { units.push({ ...u, skills: [...(u.skills || [])] }); continue; }
    for (const s of u.skills || []) if (!ex.skills.some((k) => k.id === s.id)) ex.skills.push(s);
  }
}
const skillNum = (k) => Number((String(k.id).match(/s(\d+)$/) || [])[1] || 999);
for (const u of units) u.skills.sort((a, b) => skillNum(a) - skillNum(b));
const order = meta.exam.subjects.map((s) => s.unit);
units.sort((a, b) => order.indexOf(a.id) - order.indexOf(b.id));
const library = JSON.parse(fs.readFileSync(path.join(DATA, 'libraries/lapl.json'), 'utf8'));
const data = {
  title: meta.title, disclaimer: meta.disclaimer, exam: meta.exam,
  units: units.map((u) => ({
    id: u.id, title: u.title, description: u.description,
    skills: u.skills.map((s) => ({ id: s.id, title: s.title, icon: s.icon, tips: s.tips, vocab: s.vocab.map((v) => [v.term, v.translation]), questions: s.questions.map((q) => [q.id, q.q, q.choices, q.answer, q.explanation]) })),
  })),
  library: { title: library.title, subtitle: library.subtitle, intro: library.intro, method: library.method, checklist: library.checklist, sections: library.sections, footer: library.footer },
};
const json = JSON.stringify(data);
fs.writeFileSync(path.join(HERE, 'lapl-data.json'), json);
const app = fs.readFileSync(path.join(HERE, 'app.html'), 'utf8');
const inline = `<script id="lapl-data" type="application/json">${json.replace(/</g, '\\u003c')}</script>`;
const standalone = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><style>:root{color-scheme:light}body{margin:0;font:14px system-ui,sans-serif}img{max-width:100%}[hidden]{display:none!important}</style></head><body>${inline}\n${app}</body></html>`;
fs.writeFileSync(path.join(HERE, 'Prepa-LAPL-PPL.html'), standalone);
const q = data.units.reduce((n, u) => n + u.skills.reduce((m, s) => m + s.questions.length, 0), 0);
console.log(`✓ lapl-data.json (${(json.length / 1024).toFixed(0)} Ko, ${data.units.length} matières, ${q} questions) et Prepa-LAPL-PPL.html`);
