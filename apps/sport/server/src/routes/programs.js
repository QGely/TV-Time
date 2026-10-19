import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { bundledPrograms, exercisesFor } from '../library.js';

const r = Router();
r.use(requireAuth);

function withNames(userId, p) {
  const lib = exercisesFor(userId);
  return {
    ...p,
    exercise_count: p.days.reduce((s, d) => s + d.exercises.length, 0),
    days: p.days.map((d) => ({ ...d, exercises: d.exercises.map((x) => ({ ...x, exercise: lib.get(x.exercise_id) ? { id: x.exercise_id, name: lib.get(x.exercise_id).name, category: lib.get(x.exercise_id).category, unit: lib.get(x.exercise_id).unit } : null })) })),
  };
}

r.get('/', (req, res) => {
  const adopted = new Set(db.prepare('SELECT DISTINCT program_id FROM routines WHERE user_id = ? AND program_id IS NOT NULL').all(req.user.id).map((x) => x.program_id));
  res.json(bundledPrograms().map((p) => ({ ...withNames(req.user.id, p), adopted: adopted.has(p.id) })));
});

r.get('/:id', (req, res) => {
  const p = bundledPrograms().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme introuvable' });
  const adopted = !!db.prepare('SELECT 1 FROM routines WHERE user_id = ? AND program_id = ?').get(req.user.id, p.id);
  res.json({ ...withNames(req.user.id, p), adopted });
});

/** Copies each day of the program into the user's routines. */
r.post('/:id/adopt', (req, res) => {
  const p = bundledPrograms().find((x) => x.id === req.params.id);
  if (!p) return res.status(404).json({ error: 'Programme introuvable' });
  const lib = exercisesFor(req.user.id);
  const maxPos = db.prepare('SELECT COALESCE(MAX(position), 0) AS m FROM routines WHERE user_id = ?').get(req.user.id).m;
  const insRoutine = db.prepare('INSERT INTO routines (user_id, name, description, program_id, day_index, icon, position) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const insEx = db.prepare('INSERT INTO routine_exercises (routine_id, position, exercise_id, sets, reps, rest_seconds, notes) VALUES (?, ?, ?, ?, ?, ?, ?)');
  const ids = [];
  db.transaction(() => {
    db.prepare('DELETE FROM routines WHERE user_id = ? AND program_id = ?').run(req.user.id, p.id);
    p.days.forEach((d, i) => {
      const info = insRoutine.run(req.user.id, `${p.name} · ${d.name}`, d.focus, p.id, i, p.icon, maxPos + i + 1);
      ids.push(info.lastInsertRowid);
      d.exercises.filter((x) => lib.has(x.exercise_id)).forEach((x, j) => insEx.run(info.lastInsertRowid, j, x.exercise_id, x.sets, x.reps, x.rest_seconds, x.notes));
    });
  })();
  res.status(201).json({ ok: true, routine_ids: ids });
});

export default r;
