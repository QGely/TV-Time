import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';

const DATA_DIR = process.env.DATA_DIR || path.resolve(process.cwd(), '../data');
fs.mkdirSync(DATA_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, 'tvtime.db'));
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE,
  display_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  avatar TEXT,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS sessions (
  token TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS shows (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  original_name TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  first_air_date TEXT,
  last_air_date TEXT,
  status TEXT,
  in_production INTEGER DEFAULT 0,
  genres TEXT,
  networks TEXT,
  episode_run_time INTEGER,
  number_of_seasons INTEGER DEFAULT 0,
  number_of_episodes INTEGER DEFAULT 0,
  vote_average REAL,
  next_episode_to_air TEXT,
  cast_json TEXT,
  trailer_key TEXT,
  imdb_id TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS seasons (
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  poster_path TEXT,
  air_date TEXT,
  PRIMARY KEY (show_id, season_number)
);

CREATE TABLE IF NOT EXISTS episodes (
  id INTEGER PRIMARY KEY,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  season_number INTEGER NOT NULL,
  episode_number INTEGER NOT NULL,
  name TEXT,
  overview TEXT,
  still_path TEXT,
  air_date TEXT,
  runtime INTEGER,
  vote_average REAL
);
CREATE INDEX IF NOT EXISTS idx_episodes_show ON episodes(show_id, season_number, episode_number);
CREATE INDEX IF NOT EXISTS idx_episodes_air ON episodes(air_date);

CREATE TABLE IF NOT EXISTS user_shows (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  show_id INTEGER NOT NULL REFERENCES shows(id) ON DELETE CASCADE,
  list TEXT NOT NULL DEFAULT 'watching',
  favorite INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, show_id)
);

CREATE TABLE IF NOT EXISTS watched_episodes (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  episode_id INTEGER NOT NULL REFERENCES episodes(id) ON DELETE CASCADE,
  show_id INTEGER NOT NULL,
  watched_at TEXT NOT NULL DEFAULT (datetime('now')),
  reaction TEXT,
  rating INTEGER,
  PRIMARY KEY (user_id, episode_id)
);
CREATE INDEX IF NOT EXISTS idx_watched_user_show ON watched_episodes(user_id, show_id);
CREATE INDEX IF NOT EXISTS idx_watched_at ON watched_episodes(user_id, watched_at);

CREATE TABLE IF NOT EXISTS movies (
  id INTEGER PRIMARY KEY,
  title TEXT NOT NULL,
  original_title TEXT,
  overview TEXT,
  poster_path TEXT,
  backdrop_path TEXT,
  release_date TEXT,
  runtime INTEGER,
  genres TEXT,
  vote_average REAL,
  tagline TEXT,
  cast_json TEXT,
  trailer_key TEXT,
  imdb_id TEXT,
  last_synced_at TEXT
);

CREATE TABLE IF NOT EXISTS user_movies (
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  movie_id INTEGER NOT NULL REFERENCES movies(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'watchlist',
  watched_at TEXT,
  reaction TEXT,
  rating INTEGER,
  favorite INTEGER NOT NULL DEFAULT 0,
  added_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (user_id, movie_id)
);
`);

export function getSetting(key, fallback = null) {
  const row = db.prepare('SELECT value FROM settings WHERE key = ?').get(key);
  return row ? row.value : fallback;
}

export function setSetting(key, value) {
  db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value').run(key, value);
}

export function today() {
  return new Date().toISOString().slice(0, 10);
}

db.exec(`
CREATE TABLE IF NOT EXISTS collection_items (
  collection_id TEXT NOT NULL,
  item_key TEXT NOT NULL,
  type TEXT NOT NULL,
  tmdb_id INTEGER,
  status TEXT NOT NULL DEFAULT 'ok',
  resolved_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (collection_id, item_key)
);
`);
