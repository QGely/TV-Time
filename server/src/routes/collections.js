import { Router } from 'express';
import { requireAuth } from '../auth.js';
import { collectionView, getCollection, listCollections, reloadCollections, resolveCollection } from '../collections.js';
import { hasApiKey } from '../tmdb.js';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  res.json(listCollections(req.user.id));
});

r.get('/:id', (req, res) => {
  const c = getCollection(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection introuvable' });
  const view = collectionView(req.user.id, c, req.query.order === 'release' ? 'release' : 'chronological');
  if (view.pending > 0 && hasApiKey()) {
    resolveCollection(c).catch((e) => console.error('[collections]', e.message));
    view.resolving = true;
  }
  res.json(view);
});

/** Re-run TMDB lookups for entries that were not found (or everything with ?force=1). */
r.post('/:id/resolve', async (req, res) => {
  const c = getCollection(req.params.id);
  if (!c) return res.status(404).json({ error: 'Collection introuvable' });
  if (!hasApiKey()) return res.status(503).json({ error: 'Clé API TMDB manquante. Configurez-la dans les paramètres.' });
  await resolveCollection(c, { force: req.query.force === '1' });
  res.json(collectionView(req.user.id, c, req.query.order === 'release' ? 'release' : 'chronological'));
});

r.post('/reload', (req, res) => {
  if (!req.user.is_admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });
  res.json({ count: reloadCollections().length });
});

export default r;
