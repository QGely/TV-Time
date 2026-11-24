/**
 * Validates course files in server/src/data/courses.
 * Usage: node scripts/validate-courses.mjs [file.json ...]   (no args = all files)
 * Language skills need vocab (>= 4) + sentences; quiz skills need questions (>= 8).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/courses');
const args = process.argv.slice(2);
const files = (args.length ? args.map((a) => path.basename(a)) : fs.readdirSync(dir).filter((f) => f.endsWith('.json'))).sort();
let errors = 0;
const seenSkills = new Map();

for (const file of files) {
  const problems = [];
  let c;
  try { c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8')); } catch (e) { console.error(`✗ ${file}: JSON invalide (${e.message})`); errors++; continue; }
  if (!c.id) problems.push('id manquant');
  const units = Array.isArray(c.units) ? c.units : [];
  if (!units.length && !c.title) problems.push('ni units ni métadonnées');
  let qCount = 0;
  const answerDist = [0, 0, 0, 0];
  for (const u of units) {
    if (!u.id || !u.title) problems.push('unité sans id/titre');
    if (!Array.isArray(u.skills) || !u.skills.length) { problems.push(`${u.id}: aucune leçon`); continue; }
    for (const s of u.skills) {
      const where = `${u.id}/${s.id || '?'}`;
      if (!s.id || !s.title) problems.push(`${where}: id/titre manquant`);
      const key = `${c.id}:${s.id}`;
      if (seenSkills.has(key)) problems.push(`${where}: id de leçon déjà utilisé dans ${seenSkills.get(key)}`);
      seenSkills.set(key, file);
      const vocab = Array.isArray(s.vocab) ? s.vocab : [];
      for (const v of vocab) if (!v.term || !v.translation) problems.push(`${where}: entrée de vocabulaire incomplète`);
      for (const [k, f] of (Array.isArray(s.figures) ? s.figures : []).entries()) {
        const fw = `${where}/figures[${k}]`;
        if (!f.title) problems.push(`${fw}: titre manquant`);
        if (f.svg) {
          if (!/^\s*<svg[\s>]/.test(f.svg) || !/viewBox=/.test(f.svg)) problems.push(`${fw}: svg invalide (balise <svg> avec viewBox attendue)`);
          if (/<script|\son\w+\s*=|<image|<foreignObject|href=\s*["']https?:/i.test(f.svg)) problems.push(`${fw}: svg interdit (script, événement, image ou lien externe)`);
        } else if (!f.src) problems.push(`${fw}: svg ou src requis`);
        if (!f.caption || String(f.caption).length < 20) problems.push(`${fw}: légende (caption) manquante ou trop courte`);
      }
      if (Array.isArray(s.questions)) {
        if (!/^u\d+s\d+$/.test(s.id || '')) problems.push(`${where}: id de leçon attendu au format u<N>s<M>`);
        if (!s.tips || s.tips.length < 200) problems.push(`${where}: fiche (tips) absente ou trop courte (< 200 caractères)`);
        if (vocab.length < 4) problems.push(`${where}: glossaire < 4 termes`);
        for (const v of vocab) if (String(v.translation || '').length > 70) problems.push(`${where}: définition trop longue pour « ${v.term} » (> 70 caractères)`);
        if (s.questions.length < 8) problems.push(`${where}: moins de 8 questions`);
        const qids = new Set();
        for (const q of s.questions) {
          const qw = `${where}/${q.id || '?'}`;
          if (!q.id || !/^u\d+s\d+q\d+$/.test(q.id)) problems.push(`${qw}: id de question attendu au format u<N>s<M>q<K>`);
          if (qids.has(q.id)) problems.push(`${qw}: id en double`);
          qids.add(q.id);
          if (!q.q || String(q.q).trim().length < 8) problems.push(`${qw}: énoncé manquant`);
          if (!Array.isArray(q.choices) || q.choices.length !== 4) problems.push(`${qw}: il faut exactement 4 choix`);
          else {
            if (q.choices.some((x) => !String(x || '').trim())) problems.push(`${qw}: choix vide`);
            if (new Set(q.choices.map((x) => String(x).trim().toLowerCase())).size !== 4) problems.push(`${qw}: choix en double`);
          }
          if (!Number.isInteger(q.answer) || q.answer < 0 || q.answer > 3) problems.push(`${qw}: answer doit être un entier 0-3`);
          else answerDist[q.answer]++;
          if (!q.explanation || String(q.explanation).trim().length < 15) problems.push(`${qw}: explication manquante`);
          qCount++;
        }
      } else if (vocab.length < 4) {
        problems.push(`${where}: vocabulaire < 4 mots`);
      }
    }
  }
  if (qCount >= 20) {
    const max = Math.max(...answerDist);
    if (max / qCount > 0.4) problems.push(`répartition des bonnes réponses déséquilibrée (A/B/C/D = ${answerDist.join('/')})`);
    // Indice de longueur : la bonne réponse ne doit pas être reconnaissable parce qu'elle est la plus longue.
    let longest = 0; const gaps = [];
    for (const u of units) for (const s of u.skills || []) for (const q of s.questions || []) {
      if (!Array.isArray(q.choices) || q.choices.length !== 4 || !Number.isInteger(q.answer)) continue;
      const L = q.choices.map((x) => String(x).length); const other = Math.max(...L.filter((_, i) => i !== q.answer));
      if (L[q.answer] > other) longest++;
      if (L[q.answer] - other >= 6) gaps.push(q.id);
    }
    if (longest / qCount > 0.32) problems.push(`la bonne réponse est le choix le plus long dans ${Math.round((longest / qCount) * 100)} % des questions (maximum 32 %)`);
    if (gaps.length) problems.push(`bonne réponse plus longue d'au moins 6 caractères que tous les distracteurs : ${gaps.join(', ')}`);
  }
  if (problems.length) {
    errors++;
    console.error(`✗ ${file}\n   - ${problems.slice(0, 40).join('\n   - ')}${problems.length > 40 ? `\n   … ${problems.length - 40} autres` : ''}`);
  } else {
    console.log(`✓ ${file}${qCount ? ` (${qCount} questions, réponses A/B/C/D = ${answerDist.join('/')})` : ''}`);
  }
}
console.log(`${files.length} fichier(s), ${errors} en erreur`);
process.exit(errors ? 1 : 0);
