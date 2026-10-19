import { Router } from 'express';
import crypto from 'node:crypto';
import { db } from '../db.js';
import { requireAuth } from '../auth.js';
import { CATEGORIES, EQUIPMENT, LEVELS, MUSCLES, e1rm, exercisesFor, getExercise } from '../library.js';

const r = Router();
r.use(requireAuth);

r.get('/meta', (_req, res) => res.json({ muscles: MUSCLES, categories: CATEGORIES, equipment: EQUIPMENT, levels: LEVELS }));

r.get('/', (req, res) => {
  const q = String(req.query.q || '').trim().toLowerCase();
  const { category, equipment, muscle, level } = req.query;
  let list = [...exercisesFor(req.user.id).values()];
  if (q) list = list.filter((e) => e.name.toLowerCase().includes(q) || (e.name_en || '').toLowerCase().includes(q));
  if (category) list = list.filter((e) => e.category === category);
  if (equipment) list = list.filter((e) => e.equipment === equipment);
  if (level) list = list.filter((e) => e.level === level);
  if (muscle) list = list.filter((e) => e.primary_muscles.includes(muscle) || e.secondary_muscles.includes(muscle));
  // Usage counts for the current user (to surface favourites first).
  const usage = new Map(db.prepare(`SELECT we.exercise_id, COUNT(*) AS n FROM workout_exercises we JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = ? GROUP BY we.exercise_id`).all(req.user.id).map((x) => [x.exercise_id, x.n]));
  list.sort((a, b) => (usage.get(b.id) || 0) - (usage.get(a.id) || 0) || a.name.localeCompare(b.name, 'fr'));
  res.json(list.map((e) => ({ ...e, usage: usage.get(e.id) || 0 })));
});

r.get('/:id', (req, res) => {
  const ex = getExercise(req.user.id, req.params.id);
  if (!ex) return res.status(404).json({ error: 'Exercice introuvable' });
  const sets = db.prepare(`SELECT s.*, w.started_at, w.id AS workout_id FROM workout_sets s
    JOIN workout_exercises we ON we.id = s.workout_exercise_id JOIN workouts w ON w.id = we.workout_id
    WHERE w.user_id = ? AND we.exercise_id = ? AND s.done = 1 AND w.finished_at IS NOT NULL ORDER BY w.started_at`).all(req.user.id, ex.id);
  const byWorkout = new Map();
  for (const s of sets) {
    if (!byWorkout.has(s.workout_id)) byWorkout.set(s.workout_id, { workout_id: s.workout_id, date: s.started_at, sets: [], best_weight: 0, best_e1rm: 0, max_reps: 0, max_seconds: 0, max_distance: 0, volume: 0 });
    const w = byWorkout.get(s.workout_id);
    w.sets.push({ reps: s.reps, weight: s.weight, seconds: s.seconds, distance_m: s.distance_m, rpe: s.rpe });
    w.best_weight = Math.max(w.best_weight, s.weight || 0);
    w.best_e1rm = Math.max(w.best_e1rm, e1rm(s.weight, s.reps));
    w.max_reps = Math.max(w.max_reps, s.reps || 0);
    w.max_seconds = Math.max(w.max_seconds, s.seconds || 0);
    w.max_distance = Math.max(w.max_distance, s.distance_m || 0);
    w.volume += (s.weight || 0) * (s.reps || 0);
  }
  const history = [...byWorkout.values()];
  const pr = {
    weight: Math.max(0, ...history.map((h) => h.best_weight)),
    e1rm: Math.max(0, ...history.map((h) => h.best_e1rm)),
    reps: Math.max(0, ...history.map((h) => h.max_reps)),
    seconds: Math.max(0, ...history.map((h) => h.max_seconds)),
    distance_m: Math.max(0, ...history.map((h) => h.max_distance)),
    volume: Math.max(0, ...history.map((h) => h.volume)),
  };
  res.json({ ...ex, history, pr, last: history[history.length - 1] || null });
});

r.post('/', (req, res) => {
  const b = req.body || {};
  if (!b.name || String(b.name).trim().length < 2) return res.status(400).json({ error: 'Nom requis' });
  const id = 'custom-' + crypto.randomBytes(4).toString('hex');
  const json = JSON.stringify({ name: String(b.name).trim(), category: b.category, equipment: b.equipment, type: b.type, unit: b.unit, level: b.level, primary_muscles: b.primary_muscles, secondary_muscles: b.secondary_muscles, instructions: b.instructions, tips: b.tips, mistakes: b.mistakes });
  db.prepare('INSERT INTO custom_exercises (id, user_id, json) VALUES (?, ?, ?)').run(id, req.user.id, json);
  res.status(201).json(getExercise(req.user.id, id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM custom_exercises WHERE id = ? AND user_id = ?').run(req.params.id, req.user.id);
  res.json({ ok: true });
});

export default r;
