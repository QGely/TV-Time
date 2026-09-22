import { Router } from 'express';
import { db, today } from '../db.js';
import { requireAuth } from '../auth.js';
import { ensureShow, syncShow } from '../sync.js';
import { computeProgress, getEpisodes, getWatchedMap, publicEpisode, publicShow } from '../library.js';

const r = Router();
r.use(requireAuth);

const REACTIONS = ['good', 'fun', 'wow', 'sad', 'love', 'bad'];
const LISTS = ['watching', 'for_later', 'stopped'];

function loadShowState(userId, showRow) {
  const episodes = getEpisodes(showRow.id);
  const watched = getWatchedMap(userId, showRow.id);
  const userShow = db.prepare('SELECT * FROM user_shows WHERE user_id = ? AND show_id = ?').get(userId, showRow.id);
  const progress = computeProgress(showRow, episodes, watched, userShow);
  const seasonRows = db.prepare('SELECT * FROM seasons WHERE show_id = ? ORDER BY season_number').all(showRow.id);
  const t = today();
  const seasons = seasonRows.map((s) => {
    const eps = episodes.filter((e) => e.season_number === s.season_number).map((e) => publicEpisode(e, watched));
    const aired = eps.filter((e) => e.air_date && e.air_date <= t);
    return {
      ...s,
      episodes: eps,
      aired_count: aired.length,
      watched_count: aired.filter((e) => e.watched).length + eps.filter((e) => e.watched && !(e.air_date && e.air_date <= t)).length,
    };
  });
  return { ...publicShow(showRow), followed: !!userShow, ...progress, seasons };
}

r.get('/:id', async (req, res) => {
  const id = Number(req.params.id);
  if (!id) return res.status(400).json({ error: 'Identifiant invalide' });
  try {
    const show = await ensureShow(id);
    res.json(loadShowState(req.user.id, show));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.post('/:id/refresh', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const show = await syncShow(id);
    res.json(loadShowState(req.user.id, show));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.post('/:id/follow', async (req, res) => {
  const id = Number(req.params.id);
  try {
    const show = await ensureShow(id);
    const list = LISTS.includes(req.body?.list) ? req.body.list : 'watching';
    db.prepare(`INSERT INTO user_shows (user_id, show_id, list) VALUES (?, ?, ?)
      ON CONFLICT(user_id, show_id) DO UPDATE SET list = excluded.list`).run(req.user.id, id, list);
    res.json(loadShowState(req.user.id, show));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.delete('/:id/follow', (req, res) => {
  const id = Number(req.params.id);
  const tx = db.transaction(() => {
    db.prepare('DELETE FROM user_shows WHERE user_id = ? AND show_id = ?').run(req.user.id, id);
    if (req.query.keep_history !== '1') db.prepare('DELETE FROM watched_episodes WHERE user_id = ? AND show_id = ?').run(req.user.id, id);
  });
  tx();
  const show = db.prepare('SELECT * FROM shows WHERE id = ?').get(id);
  res.json(show ? loadShowState(req.user.id, show) : { ok: true });
});

r.put('/:id/list', (req, res) => {
  const id = Number(req.params.id);
  const { list, favorite } = req.body || {};
  const us = db.prepare('SELECT * FROM user_shows WHERE user_id = ? AND show_id = ?').get(req.user.id, id);
  if (!us) return res.status(404).json({ error: 'Série non suivie' });
  if (list !== undefined) {
    if (!LISTS.includes(list)) return res.status(400).json({ error: 'Liste invalide' });
    db.prepare('UPDATE user_shows SET list = ? WHERE user_id = ? AND show_id = ?').run(list, req.user.id, id);
  }
  if (favorite !== undefined) db.prepare('UPDATE user_shows SET favorite = ? WHERE user_id = ? AND show_id = ?').run(favorite ? 1 : 0, req.user.id, id);
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(id)));
});

function ensureFollowed(userId, showId) {
  db.prepare('INSERT OR IGNORE INTO user_shows (user_id, show_id, list) VALUES (?, ?, ?)').run(userId, showId, 'watching');
}

const markWatched = db.prepare(`INSERT INTO watched_episodes (user_id, episode_id, show_id, watched_at) VALUES (?, ?, ?, ?)
  ON CONFLICT(user_id, episode_id) DO NOTHING`);

function watchedAtFrom(body) {
  const v = body?.watched_at;
  if (v && !Number.isNaN(Date.parse(v))) return new Date(v).toISOString().replace('T', ' ').slice(0, 19);
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** Mark one episode as watched. Optionally, all previous episodes (TV Time "mark previous as watched"). */
r.post('/:id/episodes/:episodeId/watch', (req, res) => {
  const showId = Number(req.params.id);
  const epId = Number(req.params.episodeId);
  const ep = db.prepare('SELECT * FROM episodes WHERE id = ? AND show_id = ?').get(epId, showId);
  if (!ep) return res.status(404).json({ error: 'Épisode introuvable' });
  const at = watchedAtFrom(req.body);
  const tx = db.transaction(() => {
    ensureFollowed(req.user.id, showId);
    if (req.body?.previous) {
      const t = today();
      const prev = db.prepare(`SELECT id FROM episodes WHERE show_id = ? AND season_number > 0 AND air_date IS NOT NULL AND air_date <= ?
        AND (season_number < ? OR (season_number = ? AND episode_number <= ?))`).all(showId, t, ep.season_number, ep.season_number, ep.episode_number);
      for (const p of prev) markWatched.run(req.user.id, p.id, showId, at);
    }
    markWatched.run(req.user.id, epId, showId, at);
  });
  tx();
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

r.delete('/:id/episodes/:episodeId/watch', (req, res) => {
  const showId = Number(req.params.id);
  db.prepare('DELETE FROM watched_episodes WHERE user_id = ? AND episode_id = ?').run(req.user.id, Number(req.params.episodeId));
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

r.put('/:id/episodes/:episodeId/reaction', (req, res) => {
  const showId = Number(req.params.id);
  const epId = Number(req.params.episodeId);
  const { reaction, rating } = req.body || {};
  if (reaction !== null && reaction !== undefined && !REACTIONS.includes(reaction)) return res.status(400).json({ error: 'Réaction invalide' });
  if (rating !== null && rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) return res.status(400).json({ error: 'Note invalide' });
  const exists = db.prepare('SELECT 1 FROM watched_episodes WHERE user_id = ? AND episode_id = ?').get(req.user.id, epId);
  if (!exists) {
    const ep = db.prepare('SELECT id FROM episodes WHERE id = ? AND show_id = ?').get(epId, showId);
    if (!ep) return res.status(404).json({ error: 'Épisode introuvable' });
    ensureFollowed(req.user.id, showId);
    markWatched.run(req.user.id, epId, showId, watchedAtFrom(req.body));
  }
  if (reaction !== undefined) db.prepare('UPDATE watched_episodes SET reaction = ? WHERE user_id = ? AND episode_id = ?').run(reaction, req.user.id, epId);
  if (rating !== undefined) db.prepare('UPDATE watched_episodes SET rating = ? WHERE user_id = ? AND episode_id = ?').run(rating, req.user.id, epId);
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

/** Mark a whole season (aired episodes only) as watched / unwatched. */
r.post('/:id/seasons/:season/watch', (req, res) => {
  const showId = Number(req.params.id);
  const season = Number(req.params.season);
  const at = watchedAtFrom(req.body);
  const eps = db.prepare('SELECT id FROM episodes WHERE show_id = ? AND season_number = ? AND air_date IS NOT NULL AND air_date <= ?').all(showId, season, today());
  const tx = db.transaction(() => {
    ensureFollowed(req.user.id, showId);
    for (const e of eps) markWatched.run(req.user.id, e.id, showId, at);
  });
  tx();
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

r.delete('/:id/seasons/:season/watch', (req, res) => {
  const showId = Number(req.params.id);
  db.prepare(`DELETE FROM watched_episodes WHERE user_id = ? AND episode_id IN (SELECT id FROM episodes WHERE show_id = ? AND season_number = ?)`)
    .run(req.user.id, showId, Number(req.params.season));
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

/** Mark the whole show (all aired episodes) as watched. */
r.post('/:id/watch-all', (req, res) => {
  const showId = Number(req.params.id);
  const at = watchedAtFrom(req.body);
  const eps = db.prepare('SELECT id FROM episodes WHERE show_id = ? AND season_number > 0 AND air_date IS NOT NULL AND air_date <= ?').all(showId, today());
  const tx = db.transaction(() => {
    ensureFollowed(req.user.id, showId);
    for (const e of eps) markWatched.run(req.user.id, e.id, showId, at);
  });
  tx();
  res.json(loadShowState(req.user.id, db.prepare('SELECT * FROM shows WHERE id = ?').get(showId)));
});

export default r;
