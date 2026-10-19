import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db, getSetting, setSetting, DATA_DIR } from '../db.js';
import { requireAdmin, requireAuth, publicUser } from '../auth.js';

const r = Router();
const pkg = JSON.parse(fs.readFileSync(path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../package.json'), 'utf8'));

r.get('/', requireAuth, (req, res) => {
  res.json({ allow_registration: getSetting('allow_registration', '1') === '1', is_admin: !!req.user.is_admin });
});
r.put('/', requireAdmin, (req, res) => {
  const { allow_registration } = req.body || {};
  if (allow_registration !== undefined) setSetting('allow_registration', allow_registration ? '1' : '0');
  res.json({ ok: true });
});
r.get('/users', requireAdmin, (_req, res) => res.json(db.prepare('SELECT * FROM users ORDER BY id').all().map(publicUser)));
r.delete('/users/:id', requireAdmin, (req, res) => {
  const id = Number(req.params.id);
  if (id === req.user.id) return res.status(400).json({ error: 'Impossible de supprimer votre propre compte' });
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  res.json({ ok: true });
});

function fileSize(p) { try { return fs.statSync(p).size; } catch { return 0; } }

r.get('/system', requireAuth, async (_req, res) => {
  let disk;
  try {
    const st = await fs.promises.statfs(DATA_DIR);
    const total = Number(st.blocks) * Number(st.bsize), free = Number(st.bfree) * Number(st.bsize), available = Number(st.bavail) * Number(st.bsize);
    disk = { total, free, available, used: total - free, percent_used: total ? Math.round(((total - free) / total) * 100) : 0 };
  } catch (e) { disk = { error: e.message }; }
  const dbPath = path.join(DATA_DIR, 'learn.db');
  res.json({
    version: pkg.version, node: process.version, uptime_seconds: Math.round(process.uptime()), data_dir: DATA_DIR,
    db_bytes: fileSize(dbPath) + fileSize(dbPath + '-wal'), disk,
    counts: {
      users: db.prepare('SELECT COUNT(*) AS n FROM users').get().n,
      lessons: db.prepare('SELECT COUNT(*) AS n FROM xp_log').get().n,
      xp: db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log').get().n,
    },
  });
});

export default r;
