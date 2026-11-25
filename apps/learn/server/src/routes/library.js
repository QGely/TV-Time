import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);
const DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'data', 'libraries');
const cache = new Map();

export function loadLibrary(id) {
  if (!/^[a-z0-9-]+$/.test(id)) return null;
  if (cache.has(id)) return cache.get(id);
  const file = path.join(DIR, `${id}.json`);
  if (!fs.existsSync(file)) return null;
  try {
    const lib = JSON.parse(fs.readFileSync(file, 'utf8'));
    cache.set(id, lib);
    return lib;
  } catch (e) {
    console.error('[library] fichier invalide', id, e.message);
    return null;
  }
}

function allItemIds(lib) {
  const ids = new Set();
  for (const s of lib.sections || []) for (const it of s.items || []) ids.add(it.id);
  for (const c of lib.checklist || []) ids.add(c.id);
  return ids;
}

r.get('/:id', (req, res) => {
  const lib = loadLibrary(req.params.id);
  if (!lib) return res.status(404).json({ error: 'Bibliothèque introuvable' });
  const done = db.prepare('SELECT item_id, done_at FROM library_checks WHERE user_id = ? AND library_id = ?').all(req.user.id, req.params.id);
  res.json({ ...lib, done: Object.fromEntries(done.map((d) => [d.item_id, d.done_at])) });
});

r.put('/:id/items/:itemId', (req, res) => {
  const lib = loadLibrary(req.params.id);
  if (!lib) return res.status(404).json({ error: 'Bibliothèque introuvable' });
  if (!allItemIds(lib).has(req.params.itemId)) return res.status(404).json({ error: 'Élément inconnu' });
  if (req.body?.done) db.prepare('INSERT OR IGNORE INTO library_checks (user_id, library_id, item_id) VALUES (?, ?, ?)').run(req.user.id, req.params.id, req.params.itemId);
  else db.prepare('DELETE FROM library_checks WHERE user_id = ? AND library_id = ? AND item_id = ?').run(req.user.id, req.params.id, req.params.itemId);
  const done = db.prepare('SELECT item_id, done_at FROM library_checks WHERE user_id = ? AND library_id = ?').all(req.user.id, req.params.id);
  res.json({ done: Object.fromEntries(done.map((d) => [d.item_id, d.done_at])) });
});

export default r;
