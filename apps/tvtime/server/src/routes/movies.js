import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { ensureMovie } from '../sync.js';
import { publicMovie } from '../library.js';

const r = Router();
r.use(requireAuth);

const REACTIONS = ['good', 'fun', 'wow', 'sad', 'love', 'bad'];

function state(userId, row) {
  const um = db.prepare('SELECT * FROM user_movies WHERE user_id = ? AND movie_id = ?').get(userId, row.id);
  return {
    ...publicMovie(row),
    followed: !!um,
    status: um?.status || null,
    watched_at: um?.watched_at || null,
    reaction: um?.reaction || null,
    rating: um?.rating || null,
    favorite: !!um?.favorite,
    added_at: um?.added_at || null,
  };
}

r.get('/', (req, res) => {
  const rows = db.prepare(`SELECT m.*, um.status, um.watched_at, um.reaction, um.rating, um.favorite, um.added_at
    FROM user_movies um JOIN movies m ON m.id = um.movie_id WHERE um.user_id = ?
    ORDER BY COALESCE(um.watched_at, um.added_at) DESC`).all(req.user.id);
  res.json(rows.map((row) => ({
    ...publicMovie(row), followed: true, status: row.status, watched_at: row.watched_at,
    reaction: row.reaction, rating: row.rating, favorite: !!row.favorite, added_at: row.added_at,
  })));
});

r.get('/:id', async (req, res) => {
  try {
    const movie = await ensureMovie(Number(req.params.id));
    res.json(state(req.user.id, movie));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.post('/:id/watchlist', async (req, res) => {
  try {
    const movie = await ensureMovie(Number(req.params.id));
    db.prepare(`INSERT INTO user_movies (user_id, movie_id, status) VALUES (?, ?, 'watchlist')
      ON CONFLICT(user_id, movie_id) DO UPDATE SET status = 'watchlist', watched_at = NULL`).run(req.user.id, movie.id);
    res.json(state(req.user.id, movie));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.post('/:id/watched', async (req, res) => {
  try {
    const movie = await ensureMovie(Number(req.params.id));
    const v = req.body?.watched_at;
    const at = (v && !Number.isNaN(Date.parse(v)) ? new Date(v) : new Date()).toISOString().replace('T', ' ').slice(0, 19);
    db.prepare(`INSERT INTO user_movies (user_id, movie_id, status, watched_at) VALUES (?, ?, 'watched', ?)
      ON CONFLICT(user_id, movie_id) DO UPDATE SET status = 'watched', watched_at = excluded.watched_at`).run(req.user.id, movie.id, at);
    res.json(state(req.user.id, movie));
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.put('/:id/reaction', (req, res) => {
  const id = Number(req.params.id);
  const { reaction, rating, favorite } = req.body || {};
  if (reaction !== null && reaction !== undefined && !REACTIONS.includes(reaction)) return res.status(400).json({ error: 'Réaction invalide' });
  if (rating !== null && rating !== undefined && !(Number.isInteger(rating) && rating >= 1 && rating <= 10)) return res.status(400).json({ error: 'Note invalide' });
  const um = db.prepare('SELECT 1 FROM user_movies WHERE user_id = ? AND movie_id = ?').get(req.user.id, id);
  if (!um) return res.status(404).json({ error: 'Film non suivi' });
  if (reaction !== undefined) db.prepare('UPDATE user_movies SET reaction = ? WHERE user_id = ? AND movie_id = ?').run(reaction, req.user.id, id);
  if (rating !== undefined) db.prepare('UPDATE user_movies SET rating = ? WHERE user_id = ? AND movie_id = ?').run(rating, req.user.id, id);
  if (favorite !== undefined) db.prepare('UPDATE user_movies SET favorite = ? WHERE user_id = ? AND movie_id = ?').run(favorite ? 1 : 0, req.user.id, id);
  res.json(state(req.user.id, db.prepare('SELECT * FROM movies WHERE id = ?').get(id)));
});

r.delete('/:id', (req, res) => {
  const id = Number(req.params.id);
  db.prepare('DELETE FROM user_movies WHERE user_id = ? AND movie_id = ?').run(req.user.id, id);
  const movie = db.prepare('SELECT * FROM movies WHERE id = ?').get(id);
  res.json(movie ? state(req.user.id, movie) : { ok: true });
});

export default r;
