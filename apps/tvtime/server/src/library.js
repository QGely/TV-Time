import { db, today } from './db.js';

export function parseJson(v, fallback) {
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

export function publicShow(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    original_name: row.original_name,
    overview: row.overview,
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    first_air_date: row.first_air_date,
    last_air_date: row.last_air_date,
    air_status: row.status,
    in_production: !!row.in_production,
    genres: parseJson(row.genres, []),
    networks: parseJson(row.networks, []),
    episode_run_time: row.episode_run_time,
    number_of_seasons: row.number_of_seasons,
    number_of_episodes: row.number_of_episodes,
    vote_average: row.vote_average,
    next_episode_to_air: parseJson(row.next_episode_to_air, null),
    cast: parseJson(row.cast_json, []),
    trailer_key: row.trailer_key,
    imdb_id: row.imdb_id,
    last_synced_at: row.last_synced_at,
  };
}

export function publicMovie(row) {
  if (!row) return null;
  return {
    id: row.id,
    title: row.title,
    original_title: row.original_title,
    overview: row.overview,
    poster_path: row.poster_path,
    backdrop_path: row.backdrop_path,
    release_date: row.release_date,
    runtime: row.runtime,
    genres: parseJson(row.genres, []),
    vote_average: row.vote_average,
    tagline: row.tagline,
    cast: parseJson(row.cast_json, []),
    trailer_key: row.trailer_key,
    imdb_id: row.imdb_id,
  };
}

export function episodeRuntime(ep, show) {
  return ep.runtime || show?.episode_run_time || 45;
}

const compareEp = (a, b) => a.season_number - b.season_number || a.episode_number - b.episode_number;

/**
 * Computes a user's progress on a show from local episodes and watched rows.
 * Specials (season 0) are excluded from progress, like TV Time.
 */
export function computeProgress(show, episodes, watchedMap, userShow) {
  const t = today();
  const regular = episodes.filter((e) => e.season_number > 0).sort(compareEp);
  const aired = regular.filter((e) => e.air_date && e.air_date <= t);
  const watchedRegular = regular.filter((e) => watchedMap.has(e.id));
  const unwatchedAired = aired.filter((e) => !watchedMap.has(e.id));
  const next = unwatchedAired[0] || null;
  const upcoming = regular.filter((e) => !e.air_date || e.air_date > t).sort((a, b) => (a.air_date || '9999').localeCompare(b.air_date || '9999'))[0] || null;

  let lastWatchedAt = null;
  for (const e of watchedRegular) {
    const w = watchedMap.get(e.id);
    if (w?.watched_at && (!lastWatchedAt || w.watched_at > lastWatchedAt)) lastWatchedAt = w.watched_at;
  }

  let status;
  const list = userShow?.list || 'watching';
  if (list === 'stopped') status = 'stopped';
  else if (list === 'for_later') status = 'for_later';
  else if (watchedRegular.length === 0 && aired.length > 0) status = 'not_started';
  else if (next) status = 'watching';
  else if (aired.length === 0) status = 'not_started';
  else status = 'up_to_date';

  const minutes = watchedRegular.reduce((sum, e) => sum + episodeRuntime(e, show), 0)
    + episodes.filter((e) => e.season_number === 0 && watchedMap.has(e.id)).reduce((s, e) => s + episodeRuntime(e, show), 0);

  return {
    status,
    list,
    favorite: !!userShow?.favorite,
    added_at: userShow?.added_at || null,
    aired_count: aired.length,
    total_count: regular.length,
    watched_count: watchedRegular.length,
    remaining_count: unwatchedAired.length,
    percent: aired.length ? Math.round((watchedRegular.length / aired.length) * 100) : 0,
    next_episode: next ? publicEpisode(next, watchedMap) : null,
    upcoming_episode: upcoming ? publicEpisode(upcoming, watchedMap) : null,
    last_watched_at: lastWatchedAt,
    minutes_watched: minutes,
  };
}

export function publicEpisode(ep, watchedMap) {
  const w = watchedMap?.get(ep.id);
  return {
    id: ep.id,
    show_id: ep.show_id,
    season_number: ep.season_number,
    episode_number: ep.episode_number,
    name: ep.name,
    overview: ep.overview,
    still_path: ep.still_path,
    air_date: ep.air_date,
    runtime: ep.runtime,
    vote_average: ep.vote_average,
    watched: !!w,
    watched_at: w?.watched_at || null,
    reaction: w?.reaction || null,
    rating: w?.rating || null,
  };
}

export function getWatchedMap(userId, showId) {
  const rows = db.prepare('SELECT episode_id, watched_at, reaction, rating FROM watched_episodes WHERE user_id = ? AND show_id = ?').all(userId, showId);
  return new Map(rows.map((r) => [r.episode_id, r]));
}

export function getEpisodes(showId) {
  return db.prepare('SELECT * FROM episodes WHERE show_id = ? ORDER BY season_number, episode_number').all(showId);
}

/** Full library of a user with progress for each followed show. */
export function getLibrary(userId) {
  const userShows = db.prepare(`
    SELECT us.*, s.* FROM user_shows us JOIN shows s ON s.id = us.show_id WHERE us.user_id = ?
  `).all(userId);
  if (!userShows.length) return [];
  const showIds = userShows.map((r) => r.show_id);
  const placeholders = showIds.map(() => '?').join(',');
  const episodes = db.prepare(`SELECT * FROM episodes WHERE show_id IN (${placeholders})`).all(...showIds);
  const watched = db.prepare(`SELECT episode_id, show_id, watched_at, reaction, rating FROM watched_episodes WHERE user_id = ? AND show_id IN (${placeholders})`).all(userId, ...showIds);

  const epsByShow = new Map();
  for (const e of episodes) {
    if (!epsByShow.has(e.show_id)) epsByShow.set(e.show_id, []);
    epsByShow.get(e.show_id).push(e);
  }
  const watchedByShow = new Map();
  for (const w of watched) {
    if (!watchedByShow.has(w.show_id)) watchedByShow.set(w.show_id, new Map());
    watchedByShow.get(w.show_id).set(w.episode_id, w);
  }

  return userShows.map((row) => {
    const show = publicShow({ ...row, id: row.show_id });
    const progress = computeProgress(row, epsByShow.get(row.show_id) || [], watchedByShow.get(row.show_id) || new Map(), row);
    return { ...show, ...progress };
  });
}
