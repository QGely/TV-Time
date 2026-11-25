import { Router } from 'express';
import { db, nowSql } from '../db.js';
import { requireAuth } from '../auth.js';
import { e1rm, exercisesFor } from '../library.js';

const r = Router();
r.use(requireAuth);

const DEFAULT_SETS = 3;

/** Full workout payload with exercises, sets and the previous performance of each exercise. */
export function loadWorkout(userId, id) {
  const w = db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(id, userId);
  if (!w) return null;
  const lib = exercisesFor(userId);
  const exercises = db.prepare('SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position, id').all(id).map((we) => {
    const sets = db.prepare('SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number, id').all(we.id).map((s) => ({ ...s, done: !!s.done }));
    const prevRows = db.prepare(`SELECT s.reps, s.weight, s.seconds, s.distance_m, s.set_number FROM workout_sets s
      JOIN workout_exercises x ON x.id = s.workout_exercise_id JOIN workouts ww ON ww.id = x.workout_id
      WHERE ww.user_id = ? AND x.exercise_id = ? AND ww.id != ? AND s.done = 1 AND ww.finished_at IS NOT NULL
      ORDER BY ww.started_at DESC, s.set_number LIMIT 12`).all(userId, we.exercise_id, id);
    // Keep only the most recent workout's sets as "previous".
    const previous = [];
    let lastNum = 0;
    for (const p of prevRows) { if (p.set_number <= lastNum) break; previous.push(p); lastNum = p.set_number; }
    const ex = lib.get(we.exercise_id) || { id: we.exercise_id, name: we.exercise_id, unit: 'reps', type: 'strength', category: 'full-body', primary_muscles: [], secondary_muscles: [], equipment: 'aucun' };
    return { ...we, exercise: ex, sets, previous };
  });
  const doneSets = exercises.flatMap((e) => e.sets).filter((s) => s.done);
  const volume = doneSets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);
  return { ...w, exercises, stats: { sets_done: doneSets.length, sets_total: exercises.reduce((s, e) => s + e.sets.length, 0), volume, reps: doneSets.reduce((s, x) => s + (x.reps || 0), 0) } };
}

function ownsWorkout(userId, id) {
  return db.prepare('SELECT * FROM workouts WHERE id = ? AND user_id = ?').get(id, userId);
}

function addExercise(workoutId, exerciseId, { target_sets, target_reps, rest_seconds, notes, previous } = {}) {
  const pos = db.prepare('SELECT COALESCE(MAX(position), -1) + 1 AS p FROM workout_exercises WHERE workout_id = ?').get(workoutId).p;
  const info = db.prepare('INSERT INTO workout_exercises (workout_id, position, exercise_id, target_sets, target_reps, rest_seconds, notes) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(workoutId, pos, exerciseId, target_sets || DEFAULT_SETS, target_reps || null, rest_seconds || 90, notes || null);
  const n = target_sets || DEFAULT_SETS;
  const ins = db.prepare('INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight, seconds, distance_m) VALUES (?, ?, ?, ?, ?, ?)');
  for (let i = 1; i <= n; i++) {
    const p = previous?.[i - 1];
    ins.run(info.lastInsertRowid, i, p?.reps ?? null, p?.weight ?? null, p?.seconds ?? null, p?.distance_m ?? null);
  }
  return info.lastInsertRowid;
}

function lastPerformance(userId, exerciseId) {
  const rows = db.prepare(`SELECT s.reps, s.weight, s.seconds, s.distance_m, s.set_number, ww.id AS wid FROM workout_sets s
    JOIN workout_exercises x ON x.id = s.workout_exercise_id JOIN workouts ww ON ww.id = x.workout_id
    WHERE ww.user_id = ? AND x.exercise_id = ? AND s.done = 1 AND ww.finished_at IS NOT NULL ORDER BY ww.started_at DESC, s.set_number LIMIT 12`).all(userId, exerciseId);
  if (!rows.length) return [];
  return rows.filter((x) => x.wid === rows[0].wid);
}

r.get('/', (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 50, 500);
  const rows = db.prepare('SELECT * FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY started_at DESC LIMIT ?').all(req.user.id, limit);
  const lib = exercisesFor(req.user.id);
  res.json(rows.map((w) => {
    const exs = db.prepare('SELECT exercise_id FROM workout_exercises WHERE workout_id = ? ORDER BY position').all(w.id);
    const agg = db.prepare(`SELECT COUNT(*) AS sets, COALESCE(SUM(COALESCE(weight,0)*COALESCE(reps,0)),0) AS volume FROM workout_sets s JOIN workout_exercises x ON x.id = s.workout_exercise_id WHERE x.workout_id = ? AND s.done = 1`).get(w.id);
    const muscles = new Set();
    for (const x of exs) for (const m of lib.get(x.exercise_id)?.primary_muscles || []) muscles.add(m);
    return { ...w, exercise_names: exs.map((x) => lib.get(x.exercise_id)?.name || x.exercise_id), exercise_count: exs.length, sets: agg.sets, volume: agg.volume, muscles: [...muscles] };
  }));
});

r.get('/active', (req, res) => {
  const w = db.prepare('SELECT id FROM workouts WHERE user_id = ? AND finished_at IS NULL ORDER BY started_at DESC LIMIT 1').get(req.user.id);
  res.json(w ? loadWorkout(req.user.id, w.id) : null);
});

/** Start a workout: blank, from a routine, or by repeating a past workout. */
r.post('/', (req, res) => {
  const { routine_id, repeat_workout_id, name } = req.body || {};
  const active = db.prepare('SELECT id FROM workouts WHERE user_id = ? AND finished_at IS NULL').get(req.user.id);
  if (active) return res.status(409).json({ error: 'Une séance est déjà en cours', workout_id: active.id });
  let wid;
  db.transaction(() => {
    if (routine_id) {
      const rt = db.prepare('SELECT * FROM routines WHERE id = ? AND user_id = ?').get(Number(routine_id), req.user.id);
      if (!rt) throw Object.assign(new Error('Routine introuvable'), { status: 404 });
      wid = db.prepare('INSERT INTO workouts (user_id, name, routine_id) VALUES (?, ?, ?)').run(req.user.id, rt.name, rt.id).lastInsertRowid;
      for (const x of db.prepare('SELECT * FROM routine_exercises WHERE routine_id = ? ORDER BY position, id').all(rt.id)) {
        addExercise(wid, x.exercise_id, { target_sets: x.sets, target_reps: x.reps, rest_seconds: x.rest_seconds, notes: x.notes, previous: lastPerformance(req.user.id, x.exercise_id) });
      }
    } else if (repeat_workout_id) {
      const src = ownsWorkout(req.user.id, Number(repeat_workout_id));
      if (!src) throw Object.assign(new Error('Séance introuvable'), { status: 404 });
      wid = db.prepare('INSERT INTO workouts (user_id, name, routine_id) VALUES (?, ?, ?)').run(req.user.id, src.name, src.routine_id).lastInsertRowid;
      for (const x of db.prepare('SELECT * FROM workout_exercises WHERE workout_id = ? ORDER BY position, id').all(src.id)) {
        const prev = db.prepare('SELECT reps, weight, seconds, distance_m FROM workout_sets WHERE workout_exercise_id = ? AND done = 1 ORDER BY set_number').all(x.id);
        addExercise(wid, x.exercise_id, { target_sets: prev.length || x.target_sets, target_reps: x.target_reps, rest_seconds: x.rest_seconds, notes: x.notes, previous: prev });
      }
    } else {
      wid = db.prepare('INSERT INTO workouts (user_id, name) VALUES (?, ?)').run(req.user.id, (name && String(name).trim().slice(0, 80)) || 'Séance libre').lastInsertRowid;
    }
  })();
  res.status(201).json(loadWorkout(req.user.id, wid));
});

r.get('/:id', (req, res) => {
  const w = loadWorkout(req.user.id, Number(req.params.id));
  if (!w) return res.status(404).json({ error: 'Séance introuvable' });
  res.json(w);
});

r.put('/:id', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  const { name, notes, rating, mood, started_at } = req.body || {};
  if (name !== undefined) db.prepare('UPDATE workouts SET name = ? WHERE id = ?').run(String(name).trim().slice(0, 80) || 'Séance', id);
  if (notes !== undefined) db.prepare('UPDATE workouts SET notes = ? WHERE id = ?').run(notes ? String(notes).slice(0, 1000) : null, id);
  if (rating !== undefined) db.prepare('UPDATE workouts SET rating = ? WHERE id = ?').run(rating ? Math.min(5, Math.max(1, Number(rating))) : null, id);
  if (mood !== undefined) db.prepare('UPDATE workouts SET mood = ? WHERE id = ?').run(mood ? String(mood).slice(0, 8) : null, id);
  if (started_at && !Number.isNaN(Date.parse(started_at))) db.prepare('UPDATE workouts SET started_at = ? WHERE id = ?').run(new Date(started_at).toISOString().replace('T', ' ').slice(0, 19), id);
  res.json(loadWorkout(req.user.id, id));
});

r.delete('/:id', (req, res) => {
  db.prepare('DELETE FROM workouts WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
  res.json({ ok: true });
});

/** Finish: compute duration, remove untouched sets and report personal records. */
r.post('/:id/finish', (req, res) => {
  const id = Number(req.params.id);
  const w = ownsWorkout(req.user.id, id);
  if (!w) return res.status(404).json({ error: 'Séance introuvable' });
  const before = loadWorkout(req.user.id, id);
  // PRs: compare each exercise's best set against history prior to this workout.
  const prs = [];
  for (const we of before.exercises) {
    const done = we.sets.filter((s) => s.done);
    if (!done.length) continue;
    const hist = db.prepare(`SELECT MAX(s.weight) AS w, MAX(s.reps) AS r, MAX(s.seconds) AS t, MAX(s.distance_m) AS d FROM workout_sets s
      JOIN workout_exercises x ON x.id = s.workout_exercise_id JOIN workouts ww ON ww.id = x.workout_id
      WHERE ww.user_id = ? AND x.exercise_id = ? AND ww.id != ? AND s.done = 1 AND ww.finished_at IS NOT NULL`).get(req.user.id, we.exercise_id, id);
    const histE1 = db.prepare(`SELECT s.weight, s.reps FROM workout_sets s JOIN workout_exercises x ON x.id = s.workout_exercise_id JOIN workouts ww ON ww.id = x.workout_id
      WHERE ww.user_id = ? AND x.exercise_id = ? AND ww.id != ? AND s.done = 1 AND ww.finished_at IS NOT NULL AND s.weight > 0 AND s.reps > 0`).all(req.user.id, we.exercise_id, id)
      .reduce((m, s) => Math.max(m, e1rm(s.weight, s.reps)), 0);
    const bestW = Math.max(...done.map((s) => s.weight || 0));
    const bestR = Math.max(...done.map((s) => s.reps || 0));
    const bestT = Math.max(...done.map((s) => s.seconds || 0));
    const bestD = Math.max(...done.map((s) => s.distance_m || 0));
    const bestE1 = Math.max(...done.map((s) => e1rm(s.weight, s.reps)));
    if (we.exercise.unit === 'reps') {
      if (bestW > 0 && bestW > (hist.w || 0)) prs.push({ exercise: we.exercise.name, kind: 'Charge max', value: `${bestW} kg` });
      else if (bestE1 > 0 && bestE1 > histE1 && hist.w) prs.push({ exercise: we.exercise.name, kind: '1RM estimé', value: `${bestE1} kg` });
      if (!bestW && bestR > (hist.r || 0) && hist.r !== null) prs.push({ exercise: we.exercise.name, kind: 'Répétitions max', value: `${bestR} reps` });
    } else if (we.exercise.unit === 'time' && bestT > (hist.t || 0) && hist.t !== null) prs.push({ exercise: we.exercise.name, kind: 'Durée max', value: `${bestT} s` });
    else if (we.exercise.unit === 'distance' && bestD > (hist.d || 0) && hist.d !== null) prs.push({ exercise: we.exercise.name, kind: 'Distance max', value: `${(bestD / 1000).toFixed(2)} km` });
  }
  const started = Date.parse(w.started_at.replace(' ', 'T') + 'Z');
  const duration = Math.max(60, Math.round((Date.now() - started) / 1000));
  db.transaction(() => {
    db.prepare('DELETE FROM workout_sets WHERE done = 0 AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)').run(id);
    db.prepare('DELETE FROM workout_exercises WHERE workout_id = ? AND id NOT IN (SELECT DISTINCT workout_exercise_id FROM workout_sets)').run(id);
    db.prepare('UPDATE workouts SET finished_at = ?, duration_seconds = ? WHERE id = ?').run(nowSql(), req.body?.duration_seconds ? Number(req.body.duration_seconds) : duration, id);
  })();
  const after = loadWorkout(req.user.id, id);
  res.json({ ...after, prs });
});

r.post('/:id/exercises', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  const { exercise_id, target_sets } = req.body || {};
  if (!exercisesFor(req.user.id).has(exercise_id)) return res.status(400).json({ error: 'Exercice inconnu' });
  addExercise(id, exercise_id, { target_sets: Number(target_sets) || undefined, previous: lastPerformance(req.user.id, exercise_id) });
  res.status(201).json(loadWorkout(req.user.id, id));
});

r.delete('/:id/exercises/:weId', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  db.prepare('DELETE FROM workout_exercises WHERE id = ? AND workout_id = ?').run(Number(req.params.weId), id);
  res.json(loadWorkout(req.user.id, id));
});

r.put('/:id/exercises/:weId', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  const { notes, rest_seconds } = req.body || {};
  if (notes !== undefined) db.prepare('UPDATE workout_exercises SET notes = ? WHERE id = ? AND workout_id = ?').run(notes ? String(notes).slice(0, 300) : null, Number(req.params.weId), id);
  if (rest_seconds !== undefined) db.prepare('UPDATE workout_exercises SET rest_seconds = ? WHERE id = ? AND workout_id = ?').run(Math.min(600, Math.max(0, Number(rest_seconds) || 0)), Number(req.params.weId), id);
  res.json(loadWorkout(req.user.id, id));
});

r.post('/:id/exercises/:weId/sets', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  const weId = Number(req.params.weId);
  const last = db.prepare('SELECT * FROM workout_sets WHERE workout_exercise_id = ? ORDER BY set_number DESC LIMIT 1').get(weId);
  db.prepare('INSERT INTO workout_sets (workout_exercise_id, set_number, reps, weight, seconds, distance_m) VALUES (?, ?, ?, ?, ?, ?)')
    .run(weId, (last?.set_number || 0) + 1, last?.reps ?? null, last?.weight ?? null, last?.seconds ?? null, last?.distance_m ?? null);
  res.status(201).json(loadWorkout(req.user.id, id));
});

r.put('/:id/sets/:setId', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  const setId = Number(req.params.setId);
  const owns = db.prepare('SELECT s.id FROM workout_sets s JOIN workout_exercises x ON x.id = s.workout_exercise_id WHERE s.id = ? AND x.workout_id = ?').get(setId, id);
  if (!owns) return res.status(404).json({ error: 'Série introuvable' });
  const b = req.body || {};
  const num = (v, max) => (v === null || v === undefined || v === '' ? null : Math.min(max, Math.max(0, Number(v) || 0)));
  if ('reps' in b) db.prepare('UPDATE workout_sets SET reps = ? WHERE id = ?').run(num(b.reps, 1000), setId);
  if ('weight' in b) db.prepare('UPDATE workout_sets SET weight = ? WHERE id = ?').run(num(b.weight, 2000), setId);
  if ('seconds' in b) db.prepare('UPDATE workout_sets SET seconds = ? WHERE id = ?').run(num(b.seconds, 86400), setId);
  if ('distance_m' in b) db.prepare('UPDATE workout_sets SET distance_m = ? WHERE id = ?').run(num(b.distance_m, 1e6), setId);
  if ('rpe' in b) db.prepare('UPDATE workout_sets SET rpe = ? WHERE id = ?').run(num(b.rpe, 10), setId);
  if ('done' in b) db.prepare('UPDATE workout_sets SET done = ?, completed_at = ? WHERE id = ?').run(b.done ? 1 : 0, b.done ? nowSql() : null, setId);
  res.json(loadWorkout(req.user.id, id));
});

r.delete('/:id/sets/:setId', (req, res) => {
  const id = Number(req.params.id);
  if (!ownsWorkout(req.user.id, id)) return res.status(404).json({ error: 'Séance introuvable' });
  db.prepare('DELETE FROM workout_sets WHERE id = ? AND workout_exercise_id IN (SELECT id FROM workout_exercises WHERE workout_id = ?)').run(Number(req.params.setId), id);
  res.json(loadWorkout(req.user.id, id));
});

export default r;
