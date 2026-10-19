import { db, today } from './db.js';
import { tmdb, pickTrailer, compactCast } from './tmdb.js';

const upsertShow = db.prepare(`
INSERT INTO shows (id, name, original_name, overview, poster_path, backdrop_path, first_air_date, last_air_date, status,
  in_production, genres, networks, episode_run_time, number_of_seasons, number_of_episodes, vote_average,
  next_episode_to_air, cast_json, trailer_key, imdb_id, last_synced_at)
VALUES (@id, @name, @original_name, @overview, @poster_path, @backdrop_path, @first_air_date, @last_air_date, @status,
  @in_production, @genres, @networks, @episode_run_time, @number_of_seasons, @number_of_episodes, @vote_average,
  @next_episode_to_air, @cast_json, @trailer_key, @imdb_id, @last_synced_at)
ON CONFLICT(id) DO UPDATE SET
  name=excluded.name, original_name=excluded.original_name, overview=excluded.overview, poster_path=excluded.poster_path,
  backdrop_path=excluded.backdrop_path, first_air_date=excluded.first_air_date, last_air_date=excluded.last_air_date,
  status=excluded.status, in_production=excluded.in_production, genres=excluded.genres, networks=excluded.networks,
  episode_run_time=excluded.episode_run_time, number_of_seasons=excluded.number_of_seasons,
  number_of_episodes=excluded.number_of_episodes, vote_average=excluded.vote_average,
  next_episode_to_air=excluded.next_episode_to_air, cast_json=excluded.cast_json, trailer_key=excluded.trailer_key,
  imdb_id=excluded.imdb_id, last_synced_at=excluded.last_synced_at
`);

const upsertSeason = db.prepare(`
INSERT INTO seasons (show_id, season_number, name, overview, poster_path, air_date)
VALUES (@show_id, @season_number, @name, @overview, @poster_path, @air_date)
ON CONFLICT(show_id, season_number) DO UPDATE SET
  name=excluded.name, overview=excluded.overview, poster_path=excluded.poster_path, air_date=excluded.air_date
`);

const upsertEpisode = db.prepare(`
INSERT INTO episodes (id, show_id, season_number, episode_number, name, overview, still_path, air_date, runtime, vote_average)
VALUES (@id, @show_id, @season_number, @episode_number, @name, @overview, @still_path, @air_date, @runtime, @vote_average)
ON CONFLICT(id) DO UPDATE SET
  show_id=excluded.show_id, season_number=excluded.season_number, episode_number=excluded.episode_number,
  name=excluded.name, overview=excluded.overview, still_path=excluded.still_path, air_date=excluded.air_date,
  runtime=excluded.runtime, vote_average=excluded.vote_average
`);

const inflight = new Map();

/**
 * Fetches a show and all its episodes from TMDB and stores them locally.
 */
export async function syncShow(showId) {
  if (inflight.has(showId)) return inflight.get(showId);
  const p = doSyncShow(showId).finally(() => inflight.delete(showId));
  inflight.set(showId, p);
  return p;
}

async function doSyncShow(showId) {
  const details = await tmdb(`/tv/${showId}`, { append_to_response: 'external_ids,credits,videos' }, { useCache: false });
  const seasonNumbers = (details.seasons || []).map((s) => s.season_number);

  // TMDB accepts up to 20 appended sub-requests per call.
  const seasonsData = [];
  for (let i = 0; i < seasonNumbers.length; i += 20) {
    const chunk = seasonNumbers.slice(i, i + 20);
    const append = chunk.map((n) => `season/${n}`).join(',');
    const res = await tmdb(`/tv/${showId}`, { append_to_response: append }, { useCache: false });
    for (const n of chunk) {
      if (res[`season/${n}`]) seasonsData.push(res[`season/${n}`]);
    }
  }

  const runtime = Array.isArray(details.episode_run_time) && details.episode_run_time.length
    ? Math.round(details.episode_run_time.reduce((a, b) => a + b, 0) / details.episode_run_time.length)
    : null;

  const tx = db.transaction(() => {
    upsertShow.run({
      id: details.id,
      name: details.name,
      original_name: details.original_name,
      overview: details.overview,
      poster_path: details.poster_path,
      backdrop_path: details.backdrop_path,
      first_air_date: details.first_air_date || null,
      last_air_date: details.last_air_date || null,
      status: details.status,
      in_production: details.in_production ? 1 : 0,
      genres: JSON.stringify((details.genres || []).map((g) => g.name)),
      networks: JSON.stringify((details.networks || []).map((n) => ({ name: n.name, logo_path: n.logo_path }))),
      episode_run_time: runtime,
      number_of_seasons: details.number_of_seasons || 0,
      number_of_episodes: details.number_of_episodes || 0,
      vote_average: details.vote_average,
      next_episode_to_air: details.next_episode_to_air ? JSON.stringify(details.next_episode_to_air) : null,
      cast_json: JSON.stringify(compactCast(details.credits)),
      trailer_key: pickTrailer(details.videos),
      imdb_id: details.external_ids?.imdb_id || null,
      last_synced_at: new Date().toISOString(),
    });

    const seenEpisodeIds = new Set();
    for (const season of seasonsData) {
      upsertSeason.run({
        show_id: details.id,
        season_number: season.season_number,
        name: season.name,
        overview: season.overview,
        poster_path: season.poster_path,
        air_date: season.air_date || null,
      });
      for (const ep of season.episodes || []) {
        seenEpisodeIds.add(ep.id);
        upsertEpisode.run({
          id: ep.id,
          show_id: details.id,
          season_number: ep.season_number,
          episode_number: ep.episode_number,
          name: ep.name,
          overview: ep.overview,
          still_path: ep.still_path,
          air_date: ep.air_date || null,
          runtime: ep.runtime || null,
          vote_average: ep.vote_average,
        });
      }
    }
    // Remove episodes that no longer exist on TMDB (renumbered/deleted), keeping watched history consistent.
    const existing = db.prepare('SELECT id FROM episodes WHERE show_id = ?').all(details.id);
    const del = db.prepare('DELETE FROM episodes WHERE id = ?');
    for (const row of existing) if (!seenEpisodeIds.has(row.id)) del.run(row.id);
    const seasonSet = new Set(seasonsData.map((s) => s.season_number));
    const existingSeasons = db.prepare('SELECT season_number FROM seasons WHERE show_id = ?').all(details.id);
    const delSeason = db.prepare('DELETE FROM seasons WHERE show_id = ? AND season_number = ?');
    for (const s of existingSeasons) if (!seasonSet.has(s.season_number)) delSeason.run(details.id, s.season_number);
  });
  tx();
  return db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
}

export async function ensureShow(showId, { maxAgeHours = 24 } = {}) {
  const row = db.prepare('SELECT * FROM shows WHERE id = ?').get(showId);
  if (row && row.last_synced_at) {
    const age = (Date.now() - Date.parse(row.last_synced_at)) / 36e5;
    if (age < maxAgeHours) return row;
    // Stale: refresh in background, serve cached data right away.
    syncShow(showId).catch((e) => console.error('[sync] show', showId, e.message));
    return row;
  }
  return syncShow(showId);
}

const upsertMovie = db.prepare(`
INSERT INTO movies (id, title, original_title, overview, poster_path, backdrop_path, release_date, runtime, genres,
  vote_average, tagline, cast_json, trailer_key, imdb_id, last_synced_at)
VALUES (@id, @title, @original_title, @overview, @poster_path, @backdrop_path, @release_date, @runtime, @genres,
  @vote_average, @tagline, @cast_json, @trailer_key, @imdb_id, @last_synced_at)
ON CONFLICT(id) DO UPDATE SET
  title=excluded.title, original_title=excluded.original_title, overview=excluded.overview, poster_path=excluded.poster_path,
  backdrop_path=excluded.backdrop_path, release_date=excluded.release_date, runtime=excluded.runtime, genres=excluded.genres,
  vote_average=excluded.vote_average, tagline=excluded.tagline, cast_json=excluded.cast_json, trailer_key=excluded.trailer_key,
  imdb_id=excluded.imdb_id, last_synced_at=excluded.last_synced_at
`);

export async function syncMovie(movieId) {
  const d = await tmdb(`/movie/${movieId}`, { append_to_response: 'credits,videos' }, { useCache: false });
  upsertMovie.run({
    id: d.id,
    title: d.title,
    original_title: d.original_title,
    overview: d.overview,
    poster_path: d.poster_path,
    backdrop_path: d.backdrop_path,
    release_date: d.release_date || null,
    runtime: d.runtime || null,
    genres: JSON.stringify((d.genres || []).map((g) => g.name)),
    vote_average: d.vote_average,
    tagline: d.tagline,
    cast_json: JSON.stringify(compactCast(d.credits)),
    trailer_key: pickTrailer(d.videos),
    imdb_id: d.imdb_id || null,
    last_synced_at: new Date().toISOString(),
  });
  return db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
}

export async function ensureMovie(movieId, { maxAgeHours = 24 * 7 } = {}) {
  const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(movieId);
  if (row && row.last_synced_at) {
    const age = (Date.now() - Date.parse(row.last_synced_at)) / 36e5;
    if (age < maxAgeHours) return row;
    syncMovie(movieId).catch((e) => console.error('[sync] movie', movieId, e.message));
    return row;
  }
  return syncMovie(movieId);
}

/**
 * Background refresh: shows followed by at least one user and still producing new
 * episodes (or recently synced) get refreshed so upcoming episodes stay accurate.
 */
export async function refreshFollowedShows() {
  const rows = db.prepare(`
    SELECT DISTINCT s.id, s.status, s.in_production, s.last_synced_at, s.next_episode_to_air
    FROM shows s JOIN user_shows us ON us.show_id = s.id
  `).all();
  const now = Date.now();
  const due = rows.filter((s) => {
    const ageH = s.last_synced_at ? (now - Date.parse(s.last_synced_at)) / 36e5 : Infinity;
    const active = s.in_production || s.next_episode_to_air || ['Returning Series', 'In Production', 'Planned', 'Pilot'].includes(s.status);
    return active ? ageH >= 12 : ageH >= 24 * 14;
  });
  let ok = 0;
  for (const s of due) {
    try {
      await syncShow(s.id);
      ok++;
    } catch (e) {
      console.error('[refresh] show', s.id, e.message);
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (due.length) console.log(`[refresh] ${ok}/${due.length} séries mises à jour`);
  return { due: due.length, ok };
}

export { today };
