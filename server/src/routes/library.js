import { Router } from 'express';
import { db, today } from '../db.js';
import { requireAuth } from '../auth.js';
import { getLibrary, publicEpisode } from '../library.js';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  const lib = getLibrary(req.user.id);
  res.json(lib);
});

/**
 * Home screen payload: "Watch next", "Upcoming", "Not started", "Up to date"...
 */
r.get('/home', (req, res) => {
  const lib = getLibrary(req.user.id);
  const byRecent = (a, b) => (b.last_watched_at || b.added_at || '').localeCompare(a.last_watched_at || a.added_at || '');
  const watch_next = lib.filter((s) => s.status === 'watching').sort(byRecent);
  const not_started = lib.filter((s) => s.status === 'not_started').sort((a, b) => (b.added_at || '').localeCompare(a.added_at || ''));
  const up_to_date = lib.filter((s) => s.status === 'up_to_date').sort(byRecent);
  const for_later = lib.filter((s) => s.status === 'for_later');
  const stopped = lib.filter((s) => s.status === 'stopped');
  const t = today();
  const horizon = new Date(Date.now() + 14 * 864e5).toISOString().slice(0, 10);
  const followedIds = lib.filter((s) => s.list !== 'stopped').map((s) => s.id);
  let upcoming = [];
  if (followedIds.length) {
    const rows = db.prepare(`SELECT e.*, s.name AS show_name, s.poster_path AS show_poster FROM episodes e JOIN shows s ON s.id = e.show_id
      WHERE e.show_id IN (${followedIds.map(() => '?').join(',')}) AND e.season_number > 0 AND e.air_date >= ? AND e.air_date <= ?
      ORDER BY e.air_date, s.name, e.season_number, e.episode_number LIMIT 60`).all(...followedIds, t, horizon);
    upcoming = rows.map((e) => ({ ...publicEpisode(e), show_name: e.show_name, show_poster: e.show_poster }));
  }
  const totalMinutes = lib.reduce((s, x) => s + x.minutes_watched, 0);
  res.json({
    watch_next, not_started, up_to_date, for_later, stopped, upcoming,
    counts: { shows: lib.length, episodes_to_watch: watch_next.reduce((s, x) => s + x.remaining_count, 0), minutes: totalMinutes },
  });
});

/** Calendar: episodes of followed shows in [from, to]. */
r.get('/calendar', (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const followed = db.prepare(`SELECT show_id FROM user_shows WHERE user_id = ? AND list != 'stopped'`).all(req.user.id).map((x) => x.show_id);
  if (!followed.length) return res.json({ from, to, episodes: [] });
  const rows = db.prepare(`SELECT e.*, s.name AS show_name, s.poster_path AS show_poster, s.backdrop_path AS show_backdrop, w.watched_at, w.reaction, w.rating
    FROM episodes e JOIN shows s ON s.id = e.show_id
    LEFT JOIN watched_episodes w ON w.episode_id = e.id AND w.user_id = ?
    WHERE e.show_id IN (${followed.map(() => '?').join(',')}) AND e.season_number > 0 AND e.air_date >= ? AND e.air_date <= ?
    ORDER BY e.air_date, s.name, e.season_number, e.episode_number`).all(req.user.id, ...followed, from, to);
  const episodes = rows.map((e) => ({
    ...publicEpisode(e), watched: !!e.watched_at, watched_at: e.watched_at, reaction: e.reaction, rating: e.rating,
    show_name: e.show_name, show_poster: e.show_poster, show_backdrop: e.show_backdrop,
  }));
  res.json({ from, to, episodes });
});

export default r;
