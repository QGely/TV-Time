import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';

const r = Router();
r.use(requireAuth);

r.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM body_log WHERE user_id = ? ORDER BY date').all(req.user.id));
});

r.post('/', (req, res) => {
  const { date, weight_kg, body_fat, note } = req.body || {};
  const d = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const w = weight_kg === null || weight_kg === undefined || weight_kg === '' ? null : Number(weight_kg);
  if (w !== null && !(w > 10 && w < 500)) return res.status(400).json({ error: 'Poids invalide' });
  db.prepare(`INSERT INTO body_log (user_id, date, weight_kg, body_fat, note) VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(user_id, date) DO UPDATE SET weight_kg = excluded.weight_kg, body_fat = excluded.body_fat, note = excluded.note`)
    .run(req.user.id, d, w, body_fat ? Number(body_fat) : null, note ? String(note).slice(0, 200) : null);
  res.json(db.prepare('SELECT * FROM body_log WHERE user_id = ? ORDER BY date').all(req.user.id));
});

r.delete('/:date', (req, res) => {
  db.prepare('DELETE FROM body_log WHERE user_id = ? AND date = ?').run(req.user.id, req.params.date);
  res.json(db.prepare('SELECT * FROM body_log WHERE user_id = ? ORDER BY date').all(req.user.id));
});

export default r;
