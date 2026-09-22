/**
 * Validates every collection file in server/src/data/collections.
 * Usage: node server/scripts/validate-collections.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/collections');
const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
let errors = 0;
const ids = new Set();

for (const file of files) {
  const problems = [];
  let c;
  try {
    c = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  } catch (e) {
    console.error(`✗ ${file}: JSON invalide (${e.message})`);
    errors++;
    continue;
  }
  for (const k of ['id', 'name', 'description', 'icon', 'category']) if (typeof c[k] !== 'string' || !c[k]) problems.push(`champ "${k}" manquant`);
  if (c.id !== path.basename(file, '.json')) problems.push(`id "${c.id}" ≠ nom de fichier`);
  if (ids.has(c.id)) problems.push('id en double');
  ids.add(c.id);
  if (!Array.isArray(c.items) || !c.items.length) problems.push('items vide');
  else {
    const n = c.items.length;
    const seenKeys = new Set();
    for (const [i, it] of c.items.entries()) {
      const where = `item ${i + 1} (${it?.title_en || '?'})`;
      if (!['movie', 'tv'].includes(it.type)) problems.push(`${where}: type invalide`);
      if (typeof it.title_en !== 'string' || !it.title_en) problems.push(`${where}: title_en manquant`);
      if (typeof it.title_fr !== 'string' || !it.title_fr) problems.push(`${where}: title_fr manquant`);
      if (!Number.isInteger(it.year) || it.year < 1900 || it.year > 2100) problems.push(`${where}: année invalide`);
      if (it.tmdb_id !== null && it.tmdb_id !== undefined && !Number.isInteger(it.tmdb_id)) problems.push(`${where}: tmdb_id invalide`);
      if (typeof it.optional !== 'boolean') problems.push(`${where}: optional doit être booléen`);
      const key = `${it.type}:${String(it.title_en).toLowerCase()}:${it.year}`;
      if (seenKeys.has(key)) problems.push(`${where}: doublon`);
      seenKeys.add(key);
    }
    for (const k of ['chronological_order', 'release_order']) {
      const vals = c.items.map((it) => it[k]);
      const ok = new Set(vals).size === n && vals.every((v) => Number.isInteger(v) && v >= 1 && v <= n);
      if (!ok) problems.push(`${k} n'est pas une permutation 1..${n}`);
    }
  }
  if (problems.length) {
    errors++;
    console.error(`✗ ${file}\n   - ${problems.join('\n   - ')}`);
  } else {
    console.log(`✓ ${file} (${c.items.length} titres)`);
  }
}
console.log(`${files.length} fichier(s), ${errors} en erreur`);
process.exit(errors ? 1 : 0);
