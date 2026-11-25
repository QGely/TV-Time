import { getSetting } from './db.js';

const BASE = process.env.TMDB_BASE_URL || 'https://api.themoviedb.org/3';
const cache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

export class TmdbError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export function getApiKey() {
  return (process.env.TMDB_API_KEY || getSetting('tmdb_api_key') || '').trim();
}

export function getLanguage() {
  return process.env.TMDB_LANGUAGE || getSetting('language') || 'fr-FR';
}

export function hasApiKey() {
  return getApiKey().length > 0;
}

export async function tmdb(endpoint, params = {}, { useCache = true } = {}) {
  const key = getApiKey();
  if (!key) throw new TmdbError('Clé API TMDB manquante. Configurez-la dans les paramètres.', 503);

  const url = new URL(BASE + endpoint);
  url.searchParams.set('language', params.language || getLanguage());
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && k !== 'language') url.searchParams.set(k, String(v));
  }

  const headers = { Accept: 'application/json' };
  const isV4Token = key.startsWith('ey');
  if (isV4Token) headers.Authorization = `Bearer ${key}`;
  else url.searchParams.set('api_key', key);

  const cacheKey = url.toString();
  if (useCache) {
    const hit = cache.get(cacheKey);
    if (hit && hit.expires > Date.now()) return hit.data;
  }

  const res = await fetch(url, { headers });
  if (!res.ok) {
    let msg = `TMDB a répondu ${res.status}`;
    try {
      const body = await res.json();
      if (body?.status_message) msg = body.status_message;
    } catch {}
    if (res.status === 401) msg = 'Clé API TMDB invalide.';
    throw new TmdbError(msg, res.status === 404 ? 404 : 502);
  }
  const data = await res.json();
  if (useCache) {
    cache.set(cacheKey, { data, expires: Date.now() + CACHE_TTL });
    if (cache.size > 500) {
      const oldest = cache.keys().next().value;
      cache.delete(oldest);
    }
  }
  return data;
}

export function pickTrailer(videos) {
  const list = videos?.results || [];
  const yt = list.filter((v) => v.site === 'YouTube');
  return (
    yt.find((v) => v.type === 'Trailer' && v.official) ||
    yt.find((v) => v.type === 'Trailer') ||
    yt.find((v) => v.type === 'Teaser') ||
    null
  )?.key || null;
}

export function compactCast(credits, limit = 12) {
  return (credits?.cast || []).slice(0, limit).map((c) => ({
    id: c.id,
    name: c.name,
    character: c.character,
    profile_path: c.profile_path,
  }));
}

export function mapSearchResult(item, forcedType) {
  const type = forcedType || item.media_type;
  if (type === 'tv') {
    return {
      type: 'tv',
      id: item.id,
      name: item.name,
      original_name: item.original_name,
      overview: item.overview,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      date: item.first_air_date || null,
      vote_average: item.vote_average,
      genre_ids: item.genre_ids || [],
    };
  }
  if (type === 'movie') {
    return {
      type: 'movie',
      id: item.id,
      name: item.title,
      original_name: item.original_title,
      overview: item.overview,
      poster_path: item.poster_path,
      backdrop_path: item.backdrop_path,
      date: item.release_date || null,
      vote_average: item.vote_average,
      genre_ids: item.genre_ids || [],
    };
  }
  return null;
}
