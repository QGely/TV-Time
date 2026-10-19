import { Router } from 'express';
import { db } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { MUSCLES, e1rm, exercisesFor } from '../library.js';

const r = Router();
r.use(requireAuth);

function isoWeekStart(d) {
  const date = new Date(d);
  const day = (date.getUTCDay() + 6) % 7;
  date.setUTCDate(date.getUTCDate() - day);
  return date.toISOString().slice(0, 10);
}

function computeStreak(dates, goalPerWeek) {
  // Weekly streak: consecutive weeks (ending this week or last week) where goal was reached.
  const weeks = new Map();
  for (const d of dates) { const w = isoWeekStart(d.replace(' ', 'T') + 'Z'); weeks.set(w, (weeks.get(w) || 0) + 1); }
  let current = 0;
  let cursor = isoWeekStart(new Date().toISOString());
  const thisWeekOk = (weeks.get(cursor) || 0) >= goalPerWeek;
  if (!thisWeekOk) cursor = new Date(Date.parse(cursor) - 7 * 864e5).toISOString().slice(0, 10);
  while ((weeks.get(cursor) || 0) >= goalPerWeek) { current++; cursor = new Date(Date.parse(cursor) - 7 * 864e5).toISOString().slice(0, 10); }
  // Day streak of consecutive training days.
  const days = new Set(dates.map((d) => d.slice(0, 10)));
  let dayStreak = 0;
  let d = new Date().toISOString().slice(0, 10);
  if (!days.has(d)) d = new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  while (days.has(d)) { dayStreak++; d = new Date(Date.parse(d) - 864e5).toISOString().slice(0, 10); }
  return { weeks: current, days: dayStreak };
}

export function statsFor(user) {
  const uid = user.id;
  const lib = exercisesFor(uid);
  const workouts = db.prepare('SELECT * FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL ORDER BY started_at').all(uid);
  const sets = db.prepare(`SELECT s.*, x.exercise_id, w.started_at FROM workout_sets s JOIN workout_exercises x ON x.id = s.workout_exercise_id
    JOIN workouts w ON w.id = x.workout_id WHERE w.user_id = ? AND s.done = 1 AND w.finished_at IS NOT NULL`).all(uid);

  const totalMinutes = workouts.reduce((s, w) => s + Math.round((w.duration_seconds || 0) / 60), 0);
  const totalVolume = sets.reduce((s, x) => s + (x.weight || 0) * (x.reps || 0), 0);

  // 12 weeks series
  const weeks = [];
  const start = isoWeekStart(new Date().toISOString());
  for (let i = 11; i >= 0; i--) weeks.push({ week: new Date(Date.parse(start) - i * 7 * 864e5).toISOString().slice(0, 10), workouts: 0, minutes: 0, volume: 0, sets: 0 });
  const wi = new Map(weeks.map((w, i) => [w.week, i]));
  for (const w of workouts) { const k = isoWeekStart(w.started_at.replace(' ', 'T') + 'Z'); if (wi.has(k)) { weeks[wi.get(k)].workouts++; weeks[wi.get(k)].minutes += Math.round((w.duration_seconds || 0) / 60); } }
  for (const s of sets) { const k = isoWeekStart(s.started_at.replace(' ', 'T') + 'Z'); if (wi.has(k)) { weeks[wi.get(k)].volume += (s.weight || 0) * (s.reps || 0); weeks[wi.get(k)].sets++; } }

  // Muscle distribution (sets per primary muscle, last 30 days)
  const since = new Date(Date.now() - 30 * 864e5).toISOString().replace('T', ' ').slice(0, 19);
  const muscleSets = {};
  for (const s of sets) {
    if (s.started_at < since) continue;
    const ex = lib.get(s.exercise_id);
    for (const m of ex?.primary_muscles || []) muscleSets[m] = (muscleSets[m] || 0) + 1;
    for (const m of ex?.secondary_muscles || []) muscleSets[m] = (muscleSets[m] || 0) + 0.5;
  }
  const muscles = Object.entries(muscleSets).map(([id, n]) => ({ id, label: MUSCLES[id] || id, sets: Math.round(n * 10) / 10 })).sort((a, b) => b.sets - a.sets);

  // PRs per exercise
  const prMap = new Map();
  for (const s of sets) {
    const ex = lib.get(s.exercise_id);
    if (!ex) continue;
    if (!prMap.has(ex.id)) prMap.set(ex.id, { id: ex.id, name: ex.name, unit: ex.unit, category: ex.category, weight: 0, e1rm: 0, reps: 0, seconds: 0, distance_m: 0, count: 0, last: null });
    const p = prMap.get(ex.id);
    p.count++;
    p.last = s.started_at;
    p.weight = Math.max(p.weight, s.weight || 0);
    p.e1rm = Math.max(p.e1rm, e1rm(s.weight, s.reps));
    p.reps = Math.max(p.reps, s.reps || 0);
    p.seconds = Math.max(p.seconds, s.seconds || 0);
    p.distance_m = Math.max(p.distance_m, s.distance_m || 0);
  }
  const prs = [...prMap.values()].sort((a, b) => b.count - a.count);

  const thisWeekStart = start;
  const thisWeek = workouts.filter((w) => isoWeekStart(w.started_at.replace(' ', 'T') + 'Z') === thisWeekStart);
  const streak = computeStreak(workouts.map((w) => w.started_at), user.weekly_goal || 3);
  const body = db.prepare('SELECT date, weight_kg FROM body_log WHERE user_id = ? AND weight_kg IS NOT NULL ORDER BY date').all(uid);

  const hours = totalMinutes / 60;
  const badges = [
    { id: 'first', label: 'Première séance', icon: '🎽', unlocked: workouts.length >= 1 },
    { id: 'w10', label: '10 séances', icon: '🔟', unlocked: workouts.length >= 10 },
    { id: 'w50', label: '50 séances', icon: '🏅', unlocked: workouts.length >= 50 },
    { id: 'w100', label: '100 séances', icon: '🏆', unlocked: workouts.length >= 100 },
    { id: 'h10', label: '10 h d’entraînement', icon: '⏱️', unlocked: hours >= 10 },
    { id: 'h100', label: '100 h d’entraînement', icon: '🕰️', unlocked: hours >= 100 },
    { id: 'v10t', label: '10 tonnes soulevées', icon: '🐘', unlocked: totalVolume >= 10000 },
    { id: 'v100t', label: '100 tonnes soulevées', icon: '🚀', unlocked: totalVolume >= 100000 },
    { id: 's4', label: '4 semaines d’affilée', icon: '🔥', unlocked: streak.weeks >= 4 },
    { id: 's12', label: '12 semaines d’affilée', icon: '🌋', unlocked: streak.weeks >= 12 },
    { id: 'early', label: 'Lève-tôt (séance avant 7 h)', icon: '🌅', unlocked: workouts.some((w) => Number(w.started_at.slice(11, 13)) < 7) },
    { id: 'body', label: 'Suivi du poids', icon: '⚖️', unlocked: body.length >= 5 },
  ];

  return {
    workouts: workouts.length,
    minutes: totalMinutes,
    volume: totalVolume,
    sets: sets.length,
    this_week: { workouts: thisWeek.length, goal: user.weekly_goal || 3, minutes: thisWeek.reduce((s, w) => s + Math.round((w.duration_seconds || 0) / 60), 0) },
    streak,
    weeks,
    muscles,
    prs,
    body,
    badges,
    favorites: prs.slice(0, 5).map((p) => ({ id: p.id, name: p.name, count: p.count })),
  };
}

r.get('/', (req, res) => res.json(statsFor(req.user)));

r.get('/users', (_req, res) => res.json(db.prepare('SELECT * FROM users ORDER BY display_name').all().map(publicUser)));

/** Household leaderboard: workouts and minutes over the last 7 and 30 days. */
r.get('/leaderboard', (_req, res) => {
  const users = db.prepare('SELECT * FROM users').all();
  const out = users.map((u) => {
    const w7 = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(duration_seconds),0) AS s FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL AND started_at >= datetime('now','-7 days')`).get(u.id);
    const w30 = db.prepare(`SELECT COUNT(*) AS n, COALESCE(SUM(duration_seconds),0) AS s FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL AND started_at >= datetime('now','-30 days')`).get(u.id);
    return { user: publicUser(u), week: { workouts: w7.n, minutes: Math.round(w7.s / 60) }, month: { workouts: w30.n, minutes: Math.round(w30.s / 60) } };
  }).sort((a, b) => b.week.workouts - a.week.workouts || b.week.minutes - a.week.minutes);
  res.json(out);
});

/** Calendar: finished workouts per day in a range. */
r.get('/calendar', (req, res) => {
  const from = /^\d{4}-\d{2}-\d{2}$/.test(req.query.from) ? req.query.from : new Date(Date.now() - 90 * 864e5).toISOString().slice(0, 10);
  const to = /^\d{4}-\d{2}-\d{2}$/.test(req.query.to) ? req.query.to : new Date().toISOString().slice(0, 10);
  const rows = db.prepare(`SELECT id, name, started_at, duration_seconds FROM workouts WHERE user_id = ? AND finished_at IS NOT NULL AND date(started_at) BETWEEN ? AND ? ORDER BY started_at`).all(req.user.id, from, to);
  res.json({ from, to, workouts: rows.map((w) => ({ ...w, date: w.started_at.slice(0, 10) })) });
});

export default r;
