import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, DATA_DIR } from '../db.js';
import { requireAdmin, requireAuth, publicUser } from '../auth.js';
import { getApiKey, getLanguage, tmdb } from '../tmdb.js';
import { refreshFollowedShows } from '../sync.js';
import { warmUpCollections } from '../collections.js';

const r = Router();

r.get('/', requireAuth, (req, res) => {
  const key = getApiKey();
  res.json({
    language: getLanguage(),
    has_api_key: !!key,
    api_key_from_env: !!process.env.TMDB_API_KEY,
    api_key_masked: key ? key.slice(0, 4) + '••••' + key.slice(-4) : null,
    allow_registration: getSetting('allow_registration', '1') === '1',
    is_admin: !!req.user.is_admin,
  });
});

r.put('/', requireAdmin, (req, res) => {
  const { tmdb_api_key, language, allow_registration } = req.body || {};
  if (tmdb_api_key !== undefined && !process.env.TMDB_API_KEY) setSetting('tmdb_api_key', String(tmdb_api_key).trim());
  if (language !== undefined && /^[a-z]{2}(-[A-Z]{2})?$/.test(language)) setSetting('language', language);
  if (allow_registration !== undefined) setSetting('allow_registration', allow_registration ? '1' : '0');
  res.json({ ok: true });
});

r.post('/test-tmdb', requireAdmin, async (_req, res) => {
  try {
    const data = await tmdb('/configuration', {}, { useCache: false });
    res.json({ ok: true, image_base: data.images?.secure_base_url });
  } catch (e) {
    res.status(e.status || 500).json({ ok: false, error: e.message });
  }
});

r.post('/refresh', requireAdmin, async (_req, res) => {
  try {
    res.json(await refreshFollowedShows());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.post('/warm-up-collections', requireAdmin, async (_req, res) => {
  try {
    res.json(await warmUpCollections());
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

r.get('/users', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser));
});

r.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});


const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'));

function fileSize(p) {
  try { return fs.statSync(p).size; } catch { return 0; }
}

/** Disk usage of the data directory, database size and server facts (visible to every signed-in user). */
r.get('/system', requireAuth, async (_req, res) => {
  let disk = null;
  try {
    const st = await fs.promises.statfs(DATA_DIR);
    const total = Number(st.blocks) * Number(st.bsize);
    const free = Number(st.bfree) * Number(st.bsize);
    const available = Number(st.bavail) * Number(st.bsize);
    disk = { total, free, available, used: total - free, percent_used: total ? Math.round(((total - free) / total) * 100) : 0 };
  } catch (e) {
    disk = { error: e.message };
  }
  const dbPath = path.join(DATA_DIR, 'tvtime.db');
  const counts = {
    users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
    shows: db.prepare('SELECT COUNT(*) AS n FROM shows').get().n,
    episodes: db.prepare('SELECT COUNT(*) AS n FROM episodes').get().n,
    movies: db.prepare('SELECT COUNT(*) AS n FROM movies').get().n,
    watched: db.prepare('SELECT COUNT(*) AS n FROM watched_episodes').get().n,
  };
  res.json({
    version: pkg.version,
    node: process.version,
    uptime_seconds: Math.round(process.uptime()),
    data_dir: DATA_DIR,
    db_bytes: fileSize(dbPath) + fileSize(dbPath + '-wal'),
    disk,
    counts,
  });
});

export default r;
