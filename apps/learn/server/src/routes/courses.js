import { Router } from 'express';
import { db, today } from '../db.js';
import { requireAuth, publicUser } from '../auth.js';
import { getCourse, getSkill, loadCourses, skillPath, LEVELS_PER_SKILL } from '../courses.js';
import { buildLesson } from '../lessons.js';

const r = Router();
r.use(requireAuth);

const MAX_HEARTS = 5;
const HEART_REGEN_MS = 4 * 3600e3;

/** Hearts with time-based regeneration (one heart every 4 hours). */
export function getHearts(userId) {
  let row = db.prepare('SELECT * FROM hearts WHERE user_id = ?').get(userId);
  if (!row) { db.prepare('INSERT INTO hearts (user_id, hearts) VALUES (?, ?)').run(userId, MAX_HEARTS); row = { hearts: MAX_HEARTS, updated_at: new Date().toISOString() }; }
  let hearts = row.hearts;
  const updated = Date.parse(row.updated_at.replace(' ', 'T') + 'Z');
  if (hearts < MAX_HEARTS) {
    const regen = Math.floor((Date.now() - updated) / HEART_REGEN_MS);
    if (regen > 0) {
      hearts = Math.min(MAX_HEARTS, hearts + regen);
      db.prepare("UPDATE hearts SET hearts = ?, updated_at = datetime('now') WHERE user_id = ?").run(hearts, userId);
    }
  }
  const next = hearts < MAX_HEARTS ? Math.max(0, HEART_REGEN_MS - ((Date.now() - updated) % HEART_REGEN_MS)) : 0;
  return { hearts, max: MAX_HEARTS, next_in_ms: next };
}
function setHearts(userId, hearts) {
  db.prepare("INSERT INTO hearts (user_id, hearts, updated_at) VALUES (?, ?, datetime('now')) ON CONFLICT(user_id) DO UPDATE SET hearts = excluded.hearts, updated_at = datetime('now')").run(userId, Math.max(0, Math.min(MAX_HEARTS, hearts)));
}

/** Streak = consecutive days with XP (today or yesterday counts as alive); freezes keep it. */
export function streakFor(userId) {
  const days = new Set(db.prepare('SELECT DISTINCT date FROM xp_log WHERE user_id = ?').all(userId).map((x) => x.date));
  for (const f of db.prepare('SELECT date FROM streak_freezes WHERE user_id = ?').all(userId)) days.add(f.date);
  const t = today();
  let d = days.has(t) ? t : new Date(Date.now() - 864e5).toISOString().slice(0, 10);
  let current = 0;
  while (days.has(d)) { current++; d = new Date(Date.parse(d) - 864e5).toISOString().slice(0, 10); }
  const sorted = [...days].sort();
  let best = 0, run = 0, prev = null;
  for (const x of sorted) { run = prev && (Date.parse(x) - Date.parse(prev)) / 864e5 === 1 ? run + 1 : 1; best = Math.max(best, run); prev = x; }
  return { current, best, active_today: days.has(t) };
}

function xpToday(userId) {
  return db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ? AND date = ?').get(userId, today()).n;
}

function progressMap(userId, courseId) {
  return new Map(db.prepare('SELECT * FROM skill_progress WHERE user_id = ? AND course_id = ?').all(userId, courseId).map((p) => [p.skill_id, p]));
}

/** Strength decays over time: 1.0 right after practice → ~0.3 after 3 weeks. */
function currentStrength(p) {
  if (!p || !p.last_practiced_at) return 0;
  const days = (Date.now() - Date.parse(p.last_practiced_at.replace(' ', 'T') + 'Z')) / 864e5;
  return Math.max(0.2, Math.min(1, p.strength - days * 0.035));
}

/** The tree/path with per-skill state for the user. */
export function courseView(userId, course) {
  const progress = progressMap(userId, course.id);
  const path = skillPath(course);
  let unlocked = true;
  const units = course.units.map((u) => ({
    id: u.id, title: u.title, description: u.description, color: u.color,
    skills: u.skills.map((s) => {
      const p = progress.get(s.id);
      const level = p?.level || 0;
      const state = { id: s.id, title: s.title, icon: s.icon, level, levels: LEVELS_PER_SKILL, strength: currentStrength(p), sessions: p?.sessions || 0, words: s.vocab.length, unlocked, completed: level >= LEVELS_PER_SKILL, has_tips: !!s.tips };
      if (level < 1) unlocked = false; // next skill locks until this one has level >= 1
      return state;
    }),
  }));
  const totalLevels = path.length * LEVELS_PER_SKILL;
  const doneLevels = path.reduce((s, p) => s + Math.min(LEVELS_PER_SKILL, progress.get(p.skill.id)?.level || 0), 0);
  const next = units.flatMap((u) => u.skills).find((s) => s.unlocked && !s.completed) || null;
  const xp = db.prepare('SELECT COALESCE(SUM(xp),0) AS n FROM xp_log WHERE user_id = ? AND course_id = ?').get(userId, course.id).n;
  return { id: course.id, title: course.title, lang_name: course.lang_name, flag: course.flag, tts_lang: course.tts_lang, description: course.description, units, skill_count: course.skill_count, word_count: course.word_count, percent: totalLevels ? Math.round((doneLevels / totalLevels) * 100) : 0, next_skill: next, xp, weak_skills: units.flatMap((u) => u.skills).filter((s) => s.level > 0 && s.strength < 0.6).map((s) => s.id) };
}

r.get('/', (req, res) => {
  const list = loadCourses().map((c) => {
    const v = courseView(req.user.id, c);
    return { id: v.id, title: v.title, lang_name: v.lang_name, flag: v.flag, description: v.description, skill_count: v.skill_count, word_count: v.word_count, percent: v.percent, xp: v.xp, started: v.xp > 0 };
  });
  res.json(list);
});

r.get('/:id', (req, res) => {
  const c = getCourse(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cours introuvable' });
  db.prepare('UPDATE users SET current_course = ? WHERE id = ?').run(c.id, req.user.id);
  res.json({ ...courseView(req.user.id, c), hearts: getHearts(req.user.id), streak: streakFor(req.user.id), xp_today: xpToday(req.user.id), daily_goal: req.user.daily_goal });
});

r.get('/:id/skills/:skillId', (req, res) => {
  const c = getCourse(req.params.id);
  const found = c && getSkill(c, req.params.skillId);
  if (!found) return res.status(404).json({ error: 'Leçon introuvable' });
  const p = progressMap(req.user.id, c.id).get(found.skill.id);
  res.json({ id: found.skill.id, title: found.skill.title, icon: found.skill.icon, tips: found.skill.tips, unit: { id: found.unit.id, title: found.unit.title, color: found.unit.color }, vocab: found.skill.vocab, sentences: found.skill.sentences, level: p?.level || 0, levels: LEVELS_PER_SKILL, strength: currentStrength(p), sessions: p?.sessions || 0 });
});

/** Start a lesson (next level of a skill) or a practice session. */
r.post('/:id/skills/:skillId/lesson', (req, res) => {
  const c = getCourse(req.params.id);
  const found = c && getSkill(c, req.params.skillId);
  if (!found) return res.status(404).json({ error: 'Leçon introuvable' });
  const view = courseView(req.user.id, c);
  const st = view.units.flatMap((u) => u.skills).find((s) => s.id === found.skill.id);
  const practice = !!req.body?.practice || st.completed;
  if (!st.unlocked) return res.status(403).json({ error: 'Termine la leçon précédente pour débloquer celle-ci' });
  const hearts = getHearts(req.user.id);
  if (hearts.hearts <= 0 && !practice) return res.status(403).json({ error: 'Plus de cœurs ! Fais une séance de révision pour en récupérer.', hearts });
  const weak = db.prepare('SELECT term FROM mistakes WHERE user_id = ? AND course_id = ? AND skill_id = ? ORDER BY count DESC, last_at DESC LIMIT 4').all(req.user.id, c.id, found.skill.id).map((x) => x.term);
  const lesson = buildLesson(c, found.skill.id, practice ? Math.max(1, st.level) : st.level + 1, { practice, weakTerms: weak });
  res.json({ ...lesson, hearts });
});

/** Lose a heart on a mistake (lessons only, not practice). */
r.post('/:id/hearts/lose', (req, res) => {
  const h = getHearts(req.user.id);
  setHearts(req.user.id, h.hearts - 1);
  res.json(getHearts(req.user.id));
});

/** Complete a lesson: award XP, level up the skill, record mistakes. */
r.post('/:id/skills/:skillId/complete', (req, res) => {
  const c = getCourse(req.params.id);
  const found = c && getSkill(c, req.params.skillId);
  if (!found) return res.status(404).json({ error: 'Leçon introuvable' });
  const { correct = 0, total = 0, practice = false, mistakes = [], level = 1, perfect = false } = req.body || {};
  const prog = progressMap(req.user.id, c.id).get(found.skill.id);
  const curLevel = prog?.level || 0;
  const passed = total > 0 && correct / total >= 0.6;
  let xp = practice ? 10 : passed ? 15 : 5;
  if (perfect) xp += 5;
  let newLevel = curLevel;
  if (!practice && passed && level === curLevel + 1 && curLevel < LEVELS_PER_SKILL) newLevel = curLevel + 1;
  db.transaction(() => {
    db.prepare(`INSERT INTO skill_progress (user_id, course_id, skill_id, level, strength, last_practiced_at, sessions) VALUES (?, ?, ?, ?, 1, datetime('now'), 1)
      ON CONFLICT(user_id, course_id, skill_id) DO UPDATE SET level = excluded.level, strength = 1, last_practiced_at = datetime('now'), sessions = sessions + 1`).run(req.user.id, c.id, found.skill.id, newLevel);
    db.prepare('INSERT INTO xp_log (user_id, course_id, skill_id, kind, xp, correct, total, date) VALUES (?, ?, ?, ?, ?, ?, ?, ?)').run(req.user.id, c.id, found.skill.id, practice ? 'practice' : 'lesson', xp, Number(correct) || 0, Number(total) || 0, today());
    const ins = db.prepare(`INSERT INTO mistakes (user_id, course_id, skill_id, term) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, course_id, skill_id, term) DO UPDATE SET count = count + 1, last_at = datetime('now')`);
    for (const term of (Array.isArray(mistakes) ? mistakes : []).slice(0, 20)) ins.run(req.user.id, c.id, found.skill.id, String(term).slice(0, 120));
    if (practice && passed) { const h = getHearts(req.user.id); setHearts(req.user.id, h.hearts + 1); }
  })();
  const view = courseView(req.user.id, c);
  const streak = streakFor(req.user.id);
  const xpT = xpToday(req.user.id);
  res.json({ xp, passed, level_before: curLevel, level_after: newLevel, leveled_up: newLevel > curLevel, completed_skill: newLevel >= LEVELS_PER_SKILL && curLevel < LEVELS_PER_SKILL, streak, xp_today: xpT, daily_goal: req.user.daily_goal, goal_reached: xpT >= req.user.daily_goal && xpT - xp < req.user.daily_goal, hearts: getHearts(req.user.id), course: view });
});

/** Mixed practice over weak skills of a course (refills a heart). */
r.post('/:id/practice', (req, res) => {
  const c = getCourse(req.params.id);
  if (!c) return res.status(404).json({ error: 'Cours introuvable' });
  const view = courseView(req.user.id, c);
  const started = view.units.flatMap((u) => u.skills).filter((s) => s.level > 0);
  if (!started.length) return res.status(400).json({ error: 'Commence une leçon avant de réviser' });
  const weak = started.filter((s) => view.weak_skills.includes(s.id));
  const target = (weak.length ? weak : started)[Math.floor(Math.random() * (weak.length ? weak : started).length)];
  const weakTerms = db.prepare('SELECT term FROM mistakes WHERE user_id = ? AND course_id = ? AND skill_id = ? ORDER BY count DESC LIMIT 4').all(req.user.id, c.id, target.id).map((x) => x.term);
  res.json({ ...buildLesson(c, target.id, Math.max(1, target.level), { practice: true, weakTerms }), hearts: getHearts(req.user.id) });
});

export default r;
