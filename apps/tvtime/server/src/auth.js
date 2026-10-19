import crypto from 'node:crypto';
import { db } from './db.js';

export const COOKIE = 'tvtime_session';
const SESSION_DAYS = 90;

export function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + SESSION_DAYS * 864e5).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)').run(token, userId, expires);
  return { token, expires };
}

export function cookieOptions() {
  return {
    httpOnly: true,
    sameSite: 'lax',
    maxAge: SESSION_DAYS * 864e5,
    path: '/',
  };
}

export function publicUser(u) {
  if (!u) return null;
  return { id: u.id, username: u.username, display_name: u.display_name, avatar: u.avatar, is_admin: !!u.is_admin, created_at: u.created_at };
}

export function attachUser(req, _res, next) {
  const token = req.cookies?.[COOKIE];
  req.user = null;
  if (token) {
    const row = db.prepare(`
      SELECT u.* FROM sessions s JOIN users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')
    `).get(token);
    if (row) req.user = row;
  }
  next();
}

export function requireAuth(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
  next();
}

export function requireAdmin(req, res, next) {
  if (!req.user) return res.status(401).json({ error: 'Authentification requise' });
  if (!req.user.is_admin) return res.status(403).json({ error: 'Réservé aux administrateurs' });
  next();
}
