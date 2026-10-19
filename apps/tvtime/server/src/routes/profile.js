import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { getLibrary, parseJson } from '../library.js';

const r = Router();
r.use(requireAuth);

function statsFor(userId) {
  const lib = getLibrary(userId);
  const watched = db.prepare(`SELECT w.watched_at, w.reaction, w.rating, w.show_id, e.runtime, e.season_number, s.episode_run_time, s.genres, s.name, s.poster_path
    FROM watched_episodes w JOIN episodes e ON e.id = w.episode_id JOIN shows s ON s.id = w.show_id WHERE w.user_id = ?`).all(userId);
  const movies = db.prepare(`SELECT um.watched_at, um.reaction, um.rating, m.runtime, m.genres, m.title, m.poster_path, m.id
    FROM user_movies um JOIN movies m ON m.id = um.movie_id WHERE um.user_id = ? AND um.status = 'watched'`).all(userId);

  const epMinutes = watched.reduce((s, w) => s + (w.runtime || w.episode_run_time || 45), 0);
  const movieMinutes = movies.reduce((s, m) => s + (m.runtime || 100), 0);

  const genreMinutes = new Map();
  const bump = (genres, minutes) => {
    for (const g of parseJson(genres, [])) genreMinutes.set(g, (genreMinutes.get(g) || 0) + minutes);
  };
  for (const w of watched) bump(w.genres, w.runtime || w.episode_run_time || 45);
  for (const m of movies) bump(m.genres, m.runtime || 100);
  const genres = [...genreMinutes.entries()].map(([name, minutes]) => ({ name, minutes })).sort((a, b) => b.minutes - a.minutes).slice(0, 8);

  const months = [];
  const now = new Date();
  for (let i = 11; i >= 0; i--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    months.push({ key: d.toISOString().slice(0, 7), episodes: 0, minutes: 0, movies: 0 });
  }
  const mIndex = new Map(months.map((m, i) => [m.key, i]));
  for (const w of watched) {
    const k = (w.watched_at || '').slice(0, 7);
    if (mIndex.has(k)) { months[mIndex.get(k)].episodes++; months[mIndex.get(k)].minutes += w.runtime || w.episode_run_time || 45; }
  }
  for (const m of movies) {
    const k = (m.watched_at || '').slice(0, 7);
    if (mIndex.has(k)) { months[mIndex.get(k)].movies++; months[mIndex.get(k)].minutes += m.runtime || 100; }
  }

  const weekdays = Array(7).fill(0);
  for (const w of watched) if (w.watched_at) weekdays[new Date(w.watched_at.replace(' ', 'T') + 'Z').getUTCDay()]++;

  const reactions = {};
  for (const w of watched) if (w.reaction) reactions[w.reaction] = (reactions[w.reaction] || 0) + 1;
  for (const m of movies) if (m.reaction) reactions[m.reaction] = (reactions[m.reaction] || 0) + 1;

  const topShows = lib.map((s) => ({ id: s.id, name: s.name, poster_path: s.poster_path, minutes: s.minutes_watched, episodes: s.watched_count, percent: s.percent, status: s.status }))
    .sort((a, b) => b.minutes - a.minutes).slice(0, 10);

  const statusCounts = lib.reduce((acc, s) => { acc[s.status] = (acc[s.status] || 0) + 1; return acc; }, {});

  const streak = computeStreak(watched.map((w) => w.watched_at).concat(movies.map((m) => m.watched_at)));

  return {
    minutes: epMinutes + movieMinutes,
    episode_minutes: epMinutes,
    movie_minutes: movieMinutes,
    episodes: watched.length,
    shows: lib.length,
    shows_completed: lib.filter((s) => s.status === 'up_to_date' && !s.in_production && s.status !== 'not_started').length,
    movies: movies.length,
    genres,
    months,
    weekdays,
    reactions,
    top_shows: topShows,
    status_counts: statusCounts,
    streak,
    badges: computeBadges({ episodes: watched.length, minutes: epMinutes + movieMinutes, shows: lib.length, movies: movies.length, streak, genres }),
  };
}

function computeStreak(dates) {
  const days = new Set(dates.filter(Boolean).map((d) => d.slice(0, 10)));
  if (!days.size) return { current: 0, best: 0 };
  const sorted = [...days].sort();
  let best = 1, run = 1;
  for (let i = 1; i < sorted.length; i++) {
    const diff = (Date.parse(sorted[i]) - Date.parse(sorted[i - 1])) / 864e5;
    run = diff === 1 ? run + 1 : 1;
    best = Math.max(best, run);
  }
  const today = new Date().toISOString().slice(0, 10);
  const yesterday = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let current = 0;
  if (days.has(today) || days.has(yesterday)) {
    let d = days.has(today) ? today : yesterday;
    while (days.has(d)) { current++; d = new Date(Date.parse(d) - 864e5).toISOString().slice(0, 10); }
  }
  return { current, best };
}

function computeBadges(s) {
  const hours = s.minutes / 60;
  const badges = [
    { id: 'first_episode', label: 'Premier épisode', icon: '🎬', unlocked: s.episodes >= 1 },
    { id: 'ep_100', label: '100 épisodes', icon: '💯', unlocked: s.episodes >= 100 },
    { id: 'ep_1000', label: '1 000 épisodes', icon: '🏆', unlocked: s.episodes >= 1000 },
    { id: 'h_24', label: '24 h devant l’écran', icon: '⏰', unlocked: hours >= 24 },
    { id: 'h_240', label: '10 jours de visionnage', icon: '🛋️', unlocked: hours >= 240 },
    { id: 'h_720', label: 'Un mois entier', icon: '📅', unlocked: hours >= 720 },
    { id: 'shows_10', label: '10 séries suivies', icon: '📺', unlocked: s.shows >= 10 },
    { id: 'shows_50', label: '50 séries suivies', icon: '🗂️', unlocked: s.shows >= 50 },
    { id: 'movies_10', label: '10 films vus', icon: '🍿', unlocked: s.movies >= 10 },
    { id: 'streak_7', label: 'Série de 7 jours', icon: '🔥', unlocked: s.streak.best >= 7 },
    { id: 'streak_30', label: 'Série de 30 jours', icon: '🌋', unlocked: s.streak.best >= 30 },
    { id: 'night_owl', label: 'Explorateur de genres', icon: '🧭', unlocked: s.genres.length >= 6 },
  ];
  return badges;
}

r.get('/stats', (req, res) => res.json(statsFor(req.user.id)));

r.get('/users/:id/stats', (req, res) => {
  const u = db.prepare('SELECT * FROM users WHERE id = ?').get(Number(req.params.id));
  if (!u) return res.status(404).json({ error: 'Utilisateur introuvable' });
  res.json({ user: publicUser(u), ...statsFor(u.id) });
});

/** Recent activity of the household (all users), like TV Time's feed. */
r.get('/feed', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 200);
  const onlyMe = req.query.me === '1';
  const eps = db.prepare(`SELECT 'episode' AS kind, w.watched_at AS at, w.reaction, w.rating, u.id AS user_id, u.display_name, u.avatar,
      s.id AS show_id, s.name AS title, s.poster_path, e.id AS episode_id, e.season_number, e.episode_number, e.name AS episode_name
    FROM watched_episodes w JOIN users u ON u.id = w.user_id JOIN shows s ON s.id = w.show_id JOIN episodes e ON e.id = w.episode_id
    ${onlyMe ? 'WHERE w.user_id = ?' : ''} ORDER BY w.watched_at DESC LIMIT ?`).all(...(onlyMe ? [req.user.id] : []), limit);
  const movies = db.prepare(`SELECT 'movie' AS kind, um.watched_at AS at, um.reaction, um.rating, u.id AS user_id, u.display_name, u.avatar,
      m.id AS movie_id, m.title, m.poster_path
    FROM user_movies um JOIN users u ON u.id = um.user_id JOIN movies m ON m.id = um.movie_id
    WHERE um.status = 'watched' ${onlyMe ? 'AND um.user_id = ?' : ''} ORDER BY um.watched_at DESC LIMIT ?`).all(...(onlyMe ? [req.user.id] : []), limit);
  const all = [...eps, ...movies].sort((a, b) => (b.at || '').localeCompare(a.at || '')).slice(0, limit);

  // Group consecutive episodes of the same show by the same user (binge sessions).
  const grouped = [];
  for (const item of all) {
    const last = grouped[grouped.length - 1];
    if (last && item.kind === 'episode' && last.kind === 'episode' && last.user_id === item.user_id && last.show_id === item.show_id
      && Math.abs(Date.parse(last.at) - Date.parse(item.at)) < 6 * 3600e3) {
      last.episodes.push(item);
      last.count++;
      continue;
    }
    grouped.push({ ...item, episodes: item.kind === 'episode' ? [item] : undefined, count: 1 });
  }
  res.json(grouped);
});

r.get('/users', (_req, res) => {
  res.json(db.prepare('SELECT * FROM users ORDER BY display_name').all().map(publicUser));
});

export default r;
