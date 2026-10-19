import { Router } from 'express';
import { db, today } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { loadCourses } from '../courses.js';
import { getHearts, streakFor } from './courses.js';

const r = Router();
r.use(requireAuth);

function statsFor(user) {
  const uid = user.id;
  const totalXp = db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ?').get(uid).n;
  const lessons = db.prepare("SELECT COUNT(*) AS n FROM xp_log WHERE user_id = ? AND kind = 'lesson'").get(uid).n;
  const practices = db.prepare("SELECT COUNT(*) AS n FROM xp_log WHERE user_id = ? AND kind = 'practice'").get(uid).n;
  const t = today();
  const days = [];
  for (let i = 29; i >= 0; i--) { const d = new Date(Date.parse(t) - i * 864e5).toISOString().slice(0, 10); days.push({ date: d, xp: 0 }); }
  const di = new Map(days.map((d, i) => [d.date, i]));
  for (const row of db.prepare('SELECT date, SUM(xp) AS xp FROM xp_log WHERE user_id = ? AND date >= ? GROUP BY date').all(uid, days[0].date)) if (di.has(row.date)) days[di.get(row.date)].xp = row.xp;
  const streak = streakFor(uid);
  const xpToday = db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ? AND date = ?').get(uid, t).n;
  const courses = loadCourses().map((c) => {
    const xp = db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ? AND course_id = ?').get(uid, c.id).n;
    const learned = db.prepare('SELECT COUNT(*) AS n FROM skill_progress WHERE user_id = ? AND course_id = ? AND level > 0').get(uid, c.id).n;
    const words = db.prepare('SELECT skill_id FROM skill_progress WHERE user_id = ? AND course_id = ? AND level > 0').all(uid, c.id).reduce((s, p) => { const sk = c.units.flatMap((u) => u.skills).find((x) => x.id === p.skill_id); return s + (sk?.vocab.length || 0); }, 0);
    return { id: c.id, title: c.title, flag: c.flag, xp, skills_started: learned, skill_count: c.skill_count, words_learned: words };
  }).filter((c) => c.xp > 0);
  const accuracy = db.prepare('SELECT COALESCE(SUM(correct),0) AS c, COALESCE(SUM(total),0) AS t FROM xp_log WHERE user_id = ?').get(uid);
  const level = Math.floor(Math.sqrt(totalXp / 25)) + 1; // simple XP curve
  const nextLevelXp = 25 * level * level;
  const badges = [
    { id: 'first', label: 'Première leçon', icon: '🌱', unlocked: lessons >= 1 },
    { id: 'xp100', label: '100 XP', icon: '✨', unlocked: totalXp >= 100 },
    { id: 'xp1000', label: '1 000 XP', icon: '💎', unlocked: totalXp >= 1000 },
    { id: 'xp5000', label: '5 000 XP', icon: '👑', unlocked: totalXp >= 5000 },
    { id: 'streak7', label: 'Série de 7 jours', icon: '🔥', unlocked: streak.best >= 7 },
    { id: 'streak30', label: 'Série de 30 jours', icon: '🌋', unlocked: streak.best >= 30 },
    { id: 'words100', label: '100 mots appris', icon: '📚', unlocked: courses.reduce((s, c) => s + c.words_learned, 0) >= 100 },
    { id: 'polyglot', label: 'Polyglotte (2 langues)', icon: '🌍', unlocked: courses.length >= 2 },
    { id: 'practice10', label: '10 révisions', icon: '🔁', unlocked: practices >= 10 },
    { id: 'perfect', label: 'Leçon parfaite', icon: '🎯', unlocked: !!db.prepare('SELECT 1 FROM xp_log WHERE user_id = ? AND total > 0 AND correct = total LIMIT 1').get(uid) },
    { id: 'night', label: 'Oiseau de nuit', icon: '🦉', unlocked: !!db.prepare("SELECT 1 FROM xp_log WHERE user_id = ? AND CAST(strftime('%H', created_at) AS INTEGER) >= 23 LIMIT 1").get(uid) },
    { id: 'goal', label: 'Objectif du jour atteint', icon: '✅', unlocked: xpToday >= user.daily_goal },
  ];
  return { total_xp: totalXp, level, next_level_xp: nextLevelXp, lessons, practices, streak, xp_today: xpToday, daily_goal: user.daily_goal, days, courses, accuracy: accuracy.t ? Math.round((accuracy.c / accuracy.t) * 100) : null, hearts: getHearts(uid), badges };
}

r.get('/stats', (req, res) => res.json(statsFor(req.user)));

r.get('/leaderboard', (_req, res) => {
  const weekStart = new Date(Date.now() - 6 * 864e5).toISOString().slice(0, 10);
  const users = db.prepare('SELECT * FROM users').all();
  res.json(users.map((u) => ({
    user: publicUser(u),
    week_xp: db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ? AND date >= ?').get(u.id, weekStart).n,
    total_xp: db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ?').get(u.id).n,
    streak: streakFor(u.id).current,
  })).sort((a, b) => b.week_xp - a.week_xp || b.total_xp - a.total_xp));
});

r.post('/freeze', (req, res) => {
  // A streak freeze costs 50 XP worth of effort: allowed only if the user has ≥ 50 XP today or yesterday.
  const t = today();
  const yesterday = new Date(Date.parse(t) - 864e5).toISOString().slice(0, 10);
  const has = db.prepare('SELECT 1 FROM streak_freezes WHERE user_id = ? AND date = ?').get(req.user.id, yesterday);
  if (has) return res.json({ ok: true, streak: streakFor(req.user.id) });
  const used = db.prepare("SELECT COUNT(*) AS n FROM streak_freezes WHERE user_id = ? AND date >= date('now', '-30 days')").get(req.user.id).n;
  if (used >= 2) return res.status(400).json({ error: 'Deux gels de série maximum par mois' });
  db.prepare('INSERT OR IGNORE INTO streak_freezes (user_id, date) VALUES (?, ?)').run(req.user.id, yesterday);
  res.json({ ok: true, streak: streakFor(req.user.id) });
});

export default r;
