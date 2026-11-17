import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { exercisesFor } from '../library.js';

const r = Router();
r.use(requireAuth);

function load(userId, id) {
  const routine = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(id, userId);
  if (!routine) return null;
  const lib = exercisesFor(userId);
  const exercises = db.prepare('SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY position, id').all(id).map((x) => ({ ...x, exercise: lib.get(x.exercise_id) || { id: x.exercise_id, name: x.exercise_id, unit: 'reps', category: 'full-body', primary_muscles: [], secondary_muscles: [] } }));
  const last = db.prepare('SELECT started_at FROM workouts WHERE routine_id = ? AND user_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT 1').get(id, userId);
  const count = db.prepare('SELECT COUNT(*) AS n FROM workouts WHERE routine_id = ? AND user_id = ? AND finished_at IS NOT NULL').get(id, userId).n;
  return { ...routine, exercises, last_done_at: last?.started_at || null, times_done: count, estimated_minutes: Math.round(exercises.reduce((s, x) => s + x.sets * (x.rest_seconds + 45), 0) / 60) };
}

r.get('/', (req, res) => {
  const ids = db.prepare('SELECT id FROM routines WHERE user_id = ? ORDER BY position, id').all(req.user.id);
  res.json(ids.map((x) => load(req.user.id, x.id)));
});

r.get('/:id', (req, res) => {
  const rt = load(req.user.id, Number(req.params.id));
  if (!rt) return res.status(404).json({ error: 'Routine introuvable' });
  res.json(rt);
});

function validExercises(userId, list) {
  const lib = exercisesFor(userId);
  return (Array.isArray(list) ? list : []).filter((x) => x && lib.has(x.exercise_id)).map((x, i) => ({
    position: i, exercise_id: x.exercise_id, sets: Math.min(20, Math.max(1, Number(x.sets) || 3)), reps: String(x.reps || '10').slice(0, 40),
    rest_seconds: Math.min(600, Math.max(0, Number(x.rest_seconds) || 90)), notes: x.notes ? String(x.notes).slice(0, 300) : null,
  }));
}

r.post('/', (req, res) => {
  const { name, description, icon, exercises } = req.body || {};
  if (!name || !String(name).trim()) return res.status(400).json({ error: 'Nom requis' });
  const pos = db.prepare('SELECT COALESCE(MAX(position), 0) + 1 AS p FROM routines WHERE user_id = ?').get(req.user.id).p;
  const info = db.prepare('INSERT INTO routines (user_id, name, description, icon, position) VALUES (?, ?, ?, ?, ?)').run(req.user.id, String(name).trim().slice(0, 80), description ? String(description).slice(0, 300) : null, icon ? String(icon).slice(0, 8) : null, pos);
  const ins = db.prepare('INSERT INTO routine_exercises (routine_id, position, exercise_id, sets, reps, rest_seconds, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const x of validExercises(req.user.id, exercises)) ins.run(info.lastInsertRowid, x.position, x.exercise_id, x.sets, x.reps, x.rest_seconds, x.notes);
  res.status(201).json(load(req.user.id, info.lastInsertRowid));
});

r.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!db.prepare('SELECT 1 FROM routines WHERE id = ? AND user_id = ?').get(id, req.user.id)) return res.status(404).json({ error: 'Routine introuvable' });
  const { name, description, icon, exercises } = req.body || {};
  db.transaction(() => {
    if (name !== undefined) db.prepare('UPDATE routines SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80) || 'Routine', id);
    if (description !== undefined) db.prepare('UPDATE routines SET description = ? WHERE id = ?').run(description ? String(description).slice(0, 300) : null, id);
    if (icon !== undefined) db.prepare('UPDATE routines SET icon = ? WHERE id = ?').run(icon ? String(icon).slice(0, 8) : null, id);
    if (exercises !== undefined) {
      db.prepare('DELETE FROM routine_exercises WHERE routine_id = ?').run(id);
      const ins = db.prepare('INSERT INTO routine_exercises (routine_id, position, exercise_id, sets, reps, rest_seconds, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
      for (const x of validExercises(req.user.id, exercises)) ins.run(id, x.position, x.exercise_id, x.sets, x.reps, x.rest_seconds, x.notes);
    }
  })();
  res.json(load(req.user.id, id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM routines WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

r.put('/reorder', (req, res) => {
  const ids = Array.isArray(req.body?.ids) ? req.body.ids.map(Number) : [];
  const upd = db.prepare('UPDATE routines SET position = ? WHERE id = ? AND user_id = ?');
  db.transaction(() => ids.forEach((id, i) => upd.run(i, id, req.user.id)))();
  res.json({ ok: true });
});

export default r;
