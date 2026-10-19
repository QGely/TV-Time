import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { tmdb, mapSearchResult } from '../tmdb.js';

const r = Router();
r.use(requireAuth);

function annotate(userId, items) {
  const tvIds = items.filter((i) => i.type === 'tv').map((i) => i.id);
  const movieIds = items.filter((i) => i.type === 'movie').map((i) => i.id);
  const followed = new Set(tvIds.length ? db.prepare(`SELECT show_id FROM user_shows WHERE user_id = ? AND show_id IN (${tvIds.map(() => '?').join(',')})`).all(userId, ...tvIds).map((x) => x.show_id) : []);
  const movies = new Map(movieIds.length ? db.prepare(`SELECT movie_id, status FROM user_movies WHERE user_id = ? AND movie_id IN (${movieIds.map(() => '?').join(',')})`).all(userId, ...movieIds).map((x) => [x.movie_id, x.status]) : []);
  return items.map((i) => ({
    ...i,
    followed: i.type === 'tv' ? followed.has(i.id) : movies.has(i.id),
    movie_status: i.type === 'movie' ? movies.get(i.id) || null : undefined,
  }));
}

r.get('/search', async (req, res) => {
  const q = String(req.query.q || '').trim();
  const type = ['tv', 'movie', 'multi'].includes(req.query.type) ? req.query.type : 'multi';
  const page = Number(req.query.page) || 1;
  if (!q) return res.json({ results: [], page: 1, total_pages: 0 });
  try {
    const data = await tmdb(`/search/${type}`, { query: q, page, include_adult: false });
    const results = (data.results || []).map((i) => mapSearchResult(i, type === 'multi' ? undefined : type)).filter(Boolean);
    res.json({ results: annotate(req.user.id, results), page: data.page, total_pages: data.total_pages });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

const LISTS = {
  trending_tv: ['/trending/tv/week', 'tv'],
  trending_movie: ['/trending/movie/week', 'movie'],
  popular_tv: ['/tv/popular', 'tv'],
  top_rated_tv: ['/tv/top_rated', 'tv'],
  airing_today: ['/tv/airing_today', 'tv'],
  on_the_air: ['/tv/on_the_air', 'tv'],
  popular_movie: ['/movie/popular', 'movie'],
  now_playing: ['/movie/now_playing', 'movie'],
  upcoming_movie: ['/movie/upcoming', 'movie'],
  top_rated_movie: ['/movie/top_rated', 'movie'],
};

r.get('/list/:name', async (req, res) => {
  const def = LISTS[req.params.name];
  if (!def) return res.status(404).json({ error: 'Liste inconnue' });
  const page = Number(req.query.page) || 1;
  try {
    const data = await tmdb(def[0], { page });
    const results = (data.results || []).map((i) => mapSearchResult(i, def[1])).filter(Boolean);
    res.json({ results: annotate(req.user.id, results), page: data.page, total_pages: data.total_pages });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.get('/genres', async (_req, res) => {
  try {
    const [tv, movie] = await Promise.all([tmdb('/genre/tv/list'), tmdb('/genre/movie/list')]);
    res.json({ tv: tv.genres || [], movie: movie.genres || [] });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

r.get('/by-genre/:type/:genreId', async (req, res) => {
  const type = req.params.type === 'movie' ? 'movie' : 'tv';
  const page = Number(req.query.page) || 1;
  try {
    const data = await tmdb(`/discover/${type}`, { with_genres: req.params.genreId, sort_by: 'popularity.desc', page, include_adult: false });
    const results = (data.results || []).map((i) => mapSearchResult(i, type)).filter(Boolean);
    res.json({ results: annotate(req.user.id, results), page: data.page, total_pages: data.total_pages });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

/** Recommendations based on the user's followed shows (TMDB "similar/recommendations"). */
r.get('/recommendations', async (req, res) => {
  const seeds = db.prepare(`
    SELECT show_id FROM user_shows WHERE user_id = ? AND list != 'stopped' ORDER BY added_at DESC LIMIT 6
  `).all(req.user.id).map((x) => x.show_id);
  if (!seeds.length) return res.json({ results: [] });
  try {
    const pages = await Promise.all(seeds.map((id) => tmdb(`/tv/${id}/recommendations`).catch(() => ({ results: [] }))));
    const seen = new Set(db.prepare('SELECT show_id FROM user_shows WHERE user_id = ?').all(req.user.id).map((x) => x.show_id));
    const merged = [];
    for (const p of pages) for (const item of p.results || []) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      merged.push(mapSearchResult(item, 'tv'));
    }
    merged.sort((a, b) => (b.vote_average || 0) - (a.vote_average || 0));
    res.json({ results: annotate(req.user.id, merged.slice(0, 24)) });
  } catch (e) {
    res.status(e.status || 500).json({ error: e.message });
  }
});

export default r;
