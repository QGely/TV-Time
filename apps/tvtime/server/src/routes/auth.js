import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { db, getSetting } from '../db.js';
import { COOKIE, cookieOptions, createSession, publicUser, requireAuth } from '../auth.js';
import { hasApiKey } from '../tmdb.js';

const r = Router();

function status() {
  const userCount = db.prepare('SELECT COUNT(*) AS n FROM users').get().n;
  return {
    needs_setup: userCount === 0,
    allow_registration: userCount === 0 || getSetting('allow_registration', '1') === '1',
    has_api_key: hasApiKey(),
  };
}

r.get('/status', (_req, res) => res.json(status()));

r.get('/me', (req, res) => {
  res.json({ user: publicUser(req.user), ...status() });
});

r.post('/register', async (req, res) => {
  const { username, password, display_name } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Nom d’utilisateur et mot de passe requis' });
  if (!/^[a-zA-Z0-9_.-]{2,32}$/.test(username)) return res.status(400).json({ error: 'Nom d’utilisateur invalide (2-32 caractères, lettres, chiffres, _ . -)' });
  if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
  const st = status();
  if (!st.allow_registration) return res.status(403).json({ error: 'Les inscriptions sont fermées' });
  if (db.prepare('SELECT 1 FROM users WHERE username = ?').get(username)) return res.status(409).json({ error: 'Ce nom d’utilisateur est déjà pris' });
  const hash = await bcrypt.hash(password, 10);
  const info = db.prepare('INSERT INTO users (username, display_name, password_hash, is_admin) VALUES (?, ?, ?, ?)')
    .run(username, (display_name || username).trim(), hash, st.needs_setup ? 1 : 0);
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  const { token } = createSession(user.id);
  res.cookie(COOKIE, token, cookieOptions());
  res.status(201).json({ user: publicUser(user), ...status() });
});

r.post('/login', async (req, res) => {
  const { username, password } = req.body || {};
  const user = username ? db.prepare('SELECT * FROM users WHERE username = ?').get(username) : null;
  if (!user || !(await bcrypt.compare(password || '', user.password_hash))) {
    return res.status(401).json({ error: 'Identifiants incorrects' });
  }
  const { token } = createSession(user.id);
  res.cookie(COOKIE, token, cookieOptions());
  res.json({ user: publicUser(user), ...status() });
});

r.post('/logout', (req, res) => {
  const token = req.cookies?.[COOKIE];
  if (token) db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
  res.clearCookie(COOKIE, { path: '/' });
  res.json({ ok: true });
});

r.put('/me', requireAuth, async (req, res) => {
  const { display_name, avatar, password, current_password } = req.body || {};
  if (display_name !== undefined) {
    const dn = String(display_name).trim();
    if (!dn || dn.length > 40) return res.status(400).json({ error: 'Nom d’affichage invalide' });
    db.prepare('UPDATE users SET display_name = ? WHERE id = ?').run(dn, req.user.id);
  }
  if (avatar !== undefined) db.prepare('UPDATE users SET avatar = ? WHERE id = ?').run(avatar ? String(avatar).slice(0, 8) : null, req.user.id);
  if (password) {
    if (!(await bcrypt.compare(current_password || '', req.user.password_hash))) return res.status(400).json({ error: 'Mot de passe actuel incorrect' });
    if (password.length < 6) return res.status(400).json({ error: 'Mot de passe trop court (6 caractères minimum)' });
    db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(await bcrypt.hash(password, 10), req.user.id);
  }
  res.json({ user: publicUser(db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id)) });
});

export default r;
