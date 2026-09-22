import { Router } from 'express';
import { db, getSetting, setSetting } from '../db.js';
import { requireAdmin, requireAuth, publicUser } from '../auth.js';
import { getApiKey, getLanguage, tmdb } from '../tmdb.js';
import { refreshFollowedShows } from '../sync.js';

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

r.get('/users', requireAdmin, (_req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser));
});

r.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

export default r;
