import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';
import { tmdb, hasApiKey } from './tmdb.js';
import { ensureMovie, ensureShow } from './sync.js';
import { computeProgress, getEpisodes, getWatchedMap, publicMovie, publicShow } from './library.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = process.env.COLLECTIONS_DIR || path.join(__dirname, 'data', 'collections');

export const CATEGORIES = {
  marvel: 'Marvel',
  dc: 'DC',
  scifi: 'Science-fiction',
  fantasy: 'Fantasy',
  action: 'Action & aventure',
  horror: 'Horreur',
  series: 'Univers de séries',
  animation: 'Animation',
};

let cache = null;

/** Loads every collection JSON file from the data directory (cached in memory). */
export function loadCollections() {
  if (cache) return cache;
  const out = [];
  if (fs.existsSync(DATA_DIR)) {
    for (const file of fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json')).sort()) {
      try {
        const c = JSON.parse(fs.readFileSync(path.join(DATA_DIR, file), 'utf8'));
        if (!c?.id || !Array.isArray(c.items)) continue;
        c.items = c.items.map((it, i) => ({
          ...it,
          key: itemKey(it),
          chronological_order: it.chronological_order ?? i + 1,
          release_order: it.release_order ?? i + 1,
          optional: !!it.optional,
        }));
        out.push(c);
      } catch (e) {
        console.error('[collections] fichier invalide', file, e.message);
      }
    }
  }
  cache = out;
  return out;
}

export function reloadCollections() {
  cache = null;
  return loadCollections();
}

export function getCollection(id) {
  return loadCollections().find((c) => c.id === id) || null;
}

function itemKey(it) {
  return `${it.type}:${normalize(it.title_en)}:${it.year}`;
}

function normalize(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function yearOf(row, type) {
  const d = type === 'movie' ? row.release_date : row.first_air_date;
  return d ? Number(d.slice(0, 4)) : null;
}

function titlesOf(row, type) {
  return type === 'movie' ? [row.title, row.original_title] : [row.name, row.original_name];
}

function matches(item, row) {
  const y = yearOf(row, item.type);
  const titles = titlesOf(row, item.type).map(normalize);
  const wanted = [normalize(item.title_en), normalize(item.title_fr)];
  const titleOk = titles.some((t) => t && wanted.includes(t));
  const yearOk = y !== null && Math.abs(y - item.year) <= 1;
  return { titleOk, yearOk, ok: (titleOk && (yearOk || y === null)) || (yearOk && titles.some((t) => t && wanted.some((w) => t.includes(w) || w.includes(t)))) };
}

const getCached = db.prepare('SELECT * FROM collection_items WHERE collection_id = ? AND item_key = ?');
const putCached = db.prepare(`INSERT INTO collection_items (collection_id, item_key, type, tmdb_id, status, resolved_at)
  VALUES (?, ?, ?, ?, ?, datetime('now'))
  ON CONFLICT(collection_id, item_key) DO UPDATE SET tmdb_id = excluded.tmdb_id, status = excluded.status, resolved_at = excluded.resolved_at`);

async function fetchDetails(type, id) {
  return type === 'movie' ? ensureMovie(id) : ensureShow(id);
}

/** Resolves one collection item to a TMDB id (validated by title/year), persisting the result. */
export async function resolveItem(collectionId, item, { force = false } = {}) {
  const cached = getCached.get(collectionId, item.key);
  if (cached && !force) {
    if (cached.status === 'ok') return cached.tmdb_id;
    const ageDays = (Date.now() - Date.parse(cached.resolved_at + 'Z')) / 864e5;
    if (ageDays < 7) return null;
  }

  // 1. Trust the hinted id only if the fetched record matches title/year.
  if (item.tmdb_id) {
    try {
      const row = await fetchDetails(item.type, item.tmdb_id);
      if (row && matches(item, row).ok) {
        putCached.run(collectionId, item.key, item.type, row.id, 'ok');
        return row.id;
      }
    } catch (e) {
      if (e.status && e.status !== 404) throw e;
    }
  }

  // 2. Search by title + year, then by title only, in English then French.
  const queries = [];
  const yearParam = item.type === 'movie' ? 'year' : 'first_air_date_year';
  for (const title of [item.title_en, item.title_fr].filter(Boolean)) {
    queries.push({ query: title, [yearParam]: item.year });
    queries.push({ query: title, [yearParam]: item.year + 1 });
    queries.push({ query: title, [yearParam]: item.year - 1 });
    queries.push({ query: title });
  }
  const seen = new Set();
  for (const q of queries) {
    const key = JSON.stringify(q);
    if (seen.has(key)) continue;
    seen.add(key);
    let data;
    try {
      data = await tmdb(`/search/${item.type}`, { ...q, include_adult: false });
    } catch (e) {
      if (e.status === 503) throw e; // missing API key: stop trying
      continue;
    }
    const results = data?.results || [];
    const exact = results.find((r) => matches(item, r).titleOk && matches(item, r).yearOk);
    const loose = exact || results.find((r) => matches(item, r).ok);
    const pick = loose || (q[yearParam] ? results.find((r) => Math.abs((yearOf(r, item.type) || 0) - item.year) <= 1) : null);
    if (pick) {
      await fetchDetails(item.type, pick.id);
      putCached.run(collectionId, item.key, item.type, pick.id, 'ok');
      return pick.id;
    }
  }

  putCached.run(collectionId, item.key, item.type, null, 'not_found');
  return null;
}

const inflight = new Map();

/** Resolves all items of a collection in the background (limited concurrency). */
export function resolveCollection(collection, { force = false } = {}) {
  if (inflight.has(collection.id)) return inflight.get(collection.id);
  const run = (async () => {
    const queue = [...collection.items];
    const errors = [];
    const worker = async () => {
      while (queue.length) {
        const item = queue.shift();
        try {
          await resolveItem(collection.id, item, { force });
        } catch (e) {
          errors.push(e.message);
          if (e.status === 503) queue.length = 0;
        }
      }
    };
    await Promise.all([worker(), worker(), worker()]);
    if (errors.length) console.error(`[collections] ${collection.id}: ${errors.length} erreur(s) —`, errors[0]);
  })().finally(() => inflight.delete(collection.id));
  inflight.set(collection.id, run);
  return run;
}

export function isResolving(collectionId) {
  return inflight.has(collectionId);
}

function resolvedMap(collectionId) {
  const rows = db.prepare('SELECT item_key, tmdb_id, status FROM collection_items WHERE collection_id = ?').all(collectionId);
  return new Map(rows.map((r) => [r.item_key, r]));
}

/** Per-user progress helpers shared by list and detail views. */
function userState(userId) {
  const movies = new Map(db.prepare('SELECT movie_id, status, watched_at, rating, reaction FROM user_movies WHERE user_id = ?').all(userId).map((r) => [r.movie_id, r]));
  const shows = new Map(db.prepare('SELECT show_id, list, favorite, added_at FROM user_shows WHERE user_id = ?').all(userId).map((r) => [r.show_id, r]));
  return { movies, shows };
}

function showProgress(userId, showRow, state) {
  const us = state.shows.get(showRow.id);
  if (!us) return null;
  return computeProgress(showRow, getEpisodes(showRow.id), getWatchedMap(userId, showRow.id), us);
}

function isDone(entry) {
  if (entry.type === 'movie') return entry.user?.status === 'watched';
  return !!entry.user && entry.user.watched_count > 0 && entry.user.remaining_count === 0;
}

/** Summary rows for the collections index. */
export function listCollections(userId) {
  const state = userState(userId);
  return loadCollections().map((c) => {
    const resolved = resolvedMap(c.id);
    let done = 0, started = 0;
    for (const it of c.items) {
      const r = resolved.get(it.key);
      if (!r || r.status !== 'ok') continue;
      if (it.type === 'movie') {
        const um = state.movies.get(r.tmdb_id);
        if (um?.status === 'watched') { done++; started++; }
        else if (um) started++;
      } else if (state.shows.has(r.tmdb_id)) {
        const row = db.prepare('SELECT * FROM shows WHERE id = ?').get(r.tmdb_id);
        const p = row ? showProgress(userId, row, state) : null;
        if (p) { started++; if (p.watched_count > 0 && p.remaining_count === 0) done++; }
      }
    }
    const posters = c.items.slice(0, 4).map((it) => {
      const r = resolved.get(it.key);
      if (!r || r.status !== 'ok') return null;
      const row = it.type === 'movie' ? db.prepare('SELECT poster_path FROM movies WHERE id = ?').get(r.tmdb_id) : db.prepare('SELECT poster_path FROM shows WHERE id = ?').get(r.tmdb_id);
      return row?.poster_path || null;
    });
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      category: c.category,
      category_label: CATEGORIES[c.category] || c.category,
      item_count: c.items.length,
      movie_count: c.items.filter((i) => i.type === 'movie').length,
      tv_count: c.items.filter((i) => i.type === 'tv').length,
      required_count: c.items.filter((i) => !i.optional).length,
      done_count: done,
      started_count: started,
      percent: c.items.length ? Math.round((done / c.items.length) * 100) : 0,
      resolved_count: c.items.filter((i) => resolved.get(i.key)?.status === 'ok').length,
      posters,
    };
  });
}

/** Full detail view of a collection for one user. */
export function collectionView(userId, collection, order = 'chronological') {
  const state = userState(userId);
  const resolved = resolvedMap(collection.id);
  const key = order === 'release' ? 'release_order' : 'chronological_order';
  const items = [...collection.items].sort((a, b) => a[key] - b[key]).map((it) => {
    const r = resolved.get(it.key);
    const base = {
      key: it.key,
      type: it.type,
      title: it.title_fr || it.title_en,
      title_en: it.title_en,
      year: it.year,
      group: it.group || null,
      note: it.note || null,
      optional: it.optional,
      chronological_order: it.chronological_order,
      release_order: it.release_order,
      resolution: !r ? 'pending' : r.status === 'ok' ? 'ok' : 'not_found',
      tmdb_id: r?.status === 'ok' ? r.tmdb_id : null,
      media: null,
      user: null,
    };
    if (!base.tmdb_id) return base;
    if (it.type === 'movie') {
      const row = db.prepare('SELECT * FROM movies WHERE id = ?').get(base.tmdb_id);
      if (row) {
        base.media = publicMovie(row);
        const um = state.movies.get(row.id);
        base.user = um ? { status: um.status, watched_at: um.watched_at, rating: um.rating, reaction: um.reaction } : null;
      }
    } else {
      const row = db.prepare('SELECT * FROM shows WHERE id = ?').get(base.tmdb_id);
      if (row) {
        base.media = publicShow(row);
        base.user = showProgress(userId, row, state);
      }
    }
    return base;
  });
  const done = items.filter(isDone).length;
  const pending = items.filter((i) => i.resolution === 'pending').length;
  return {
    id: collection.id,
    name: collection.name,
    description: collection.description,
    icon: collection.icon,
    category: collection.category,
    category_label: CATEGORIES[collection.category] || collection.category,
    order,
    has_distinct_orders: collection.items.some((i) => i.chronological_order !== i.release_order),
    item_count: items.length,
    done_count: done,
    percent: items.length ? Math.round((done / items.length) * 100) : 0,
    pending,
    not_found: items.filter((i) => i.resolution === 'not_found').length,
    resolving: isResolving(collection.id),
    has_api_key: hasApiKey(),
    items,
  };
}
