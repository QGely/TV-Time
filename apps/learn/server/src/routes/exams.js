import { Router } from 'express';
import { db, today } from '../db.js';
import { requireAuth } from '../auth.js';
import { getCourse, unitQuestions } from '../courses.js';

const r = Router();
r.use(requireAuth);

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

function examConfig(course) {
  const subjects = (course.exam?.subjects || []).filter((s) => course.units.some((u) => u.id === s.unit)).map((s) => ({
    unit: s.unit,
    title: s.title || course.units.find((u) => u.id === s.unit)?.title,
    questions: Number(s.questions) || 10,
    minutes: Number(s.minutes) || 15,
    available: unitQuestions(course, s.unit).length,
    color: course.units.find((u) => u.id === s.unit)?.color,
  }));
  return { pass_percent: Number(course.exam?.pass_percent) || 75, since: course.exam?.since || null, subjects, total_questions: subjects.reduce((s, x) => s + x.questions, 0), total_minutes: subjects.reduce((s, x) => s + x.minutes, 0) };
}

function elapsedSeconds(exam) {
  return Math.round((Date.now() - Date.parse(exam.started_at.replace(' ', 'T') + 'Z')) / 1000);
}

/** Public view of an exam: in progress → no answers; finished → full correction. */
function examView(exam) {
  const questions = JSON.parse(exam.questions_json);
  const answers = JSON.parse(exam.answers_json || '{}');
  const base = {
    id: exam.id, course_id: exam.course_id, mode: exam.mode, unit_id: exam.unit_id, started_at: exam.started_at, finished_at: exam.finished_at,
    time_limit_seconds: exam.time_limit_seconds, subjects: JSON.parse(exam.results_json || 'null')?.subjects || null,
  };
  if (!exam.finished_at) {
    return {
      ...base,
      remaining_seconds: Math.max(0, exam.time_limit_seconds - elapsedSeconds(exam)),
      answers,
      questions: questions.map((q, i) => ({ index: i, unit: q.unit, subject: q.subject, q: q.q, choices: q.choices })),
    };
  }
  const results = JSON.parse(exam.results_json);
  return {
    ...base,
    duration_seconds: results.duration_seconds,
    correct: exam.correct, total: exam.total, passed: !!exam.passed, pass_percent: results.pass_percent, subjects: results.subjects,
    questions: questions.map((q, i) => ({ index: i, unit: q.unit, subject: q.subject, q: q.q, choices: q.choices, answer: q.answer, given: answers[i] ?? null, correct: answers[i] === q.answer, explanation: q.explanation, skill_id: q.skill_id })),
  };
}

function grade(course, exam, answers) {
  const questions = JSON.parse(exam.questions_json);
  const cfg = examConfig(course);
  const bySubject = new Map();
  let correct = 0;
  questions.forEach((q, i) => {
    if (!bySubject.has(q.unit)) bySubject.set(q.unit, { unit: q.unit, title: q.subject, correct: 0, total: 0 });
    const s = bySubject.get(q.unit);
    s.total++;
    if (answers[i] === q.answer) { s.correct++; correct++; }
  });
  const subjects = [...bySubject.values()].map((s) => ({ ...s, percent: Math.round((s.correct / s.total) * 100), passed: (s.correct / s.total) * 100 >= cfg.pass_percent }));
  return { subjects, correct, total: questions.length, passed: subjects.every((s) => s.passed), pass_percent: cfg.pass_percent, duration_seconds: Math.min(exam.time_limit_seconds, elapsedSeconds(exam)) };
}

function cleanAnswers(raw, count) {
  const out = {};
  for (const [k, v] of Object.entries(raw || {})) {
    const i = Number(k), a = Number(v);
    if (Number.isInteger(i) && i >= 0 && i < count && Number.isInteger(a) && a >= 0 && a <= 5) out[i] = a;
  }
  return out;
}

/** Exam format, the user's history and best score per subject. */
r.get('/:courseId', (req, res) => {
  const course = getCourse(req.params.courseId);
  if (!course?.exam) return res.status(404).json({ error: 'Pas d’examen pour ce cours' });
  const history = db.prepare('SELECT * FROM exams WHERE user_id = ? AND course_id = ? ORDER BY started_at DESC LIMIT 30').all(req.user.id, course.id);
  const active = history.find((e) => !e.finished_at && elapsedSeconds(e) < e.time_limit_seconds + 300);
  const finished = history.filter((e) => e.finished_at);
  const best = {};
  for (const e of finished) for (const s of JSON.parse(e.results_json).subjects) if (!best[s.unit] || s.percent > best[s.unit].percent) best[s.unit] = { percent: s.percent, passed: s.passed, at: e.finished_at };
  res.json({
    course: { id: course.id, title: course.title, flag: course.flag, disclaimer: course.disclaimer },
    format: examConfig(course),
    active: active ? { id: active.id, mode: active.mode, unit_id: active.unit_id, remaining_seconds: Math.max(0, active.time_limit_seconds - elapsedSeconds(active)) } : null,
    best,
    history: finished.map((e) => ({ id: e.id, mode: e.mode, unit_id: e.unit_id, started_at: e.started_at, finished_at: e.finished_at, correct: e.correct, total: e.total, passed: !!e.passed, subjects: JSON.parse(e.results_json).subjects })),
  });
});

/** Start a full exam (all subjects, official counts) or a single-subject exam. */
r.post('/:courseId', (req, res) => {
  const course = getCourse(req.params.courseId);
  if (!course?.exam) return res.status(404).json({ error: 'Pas d’examen pour ce cours' });
  const cfg = examConfig(course);
  const unit = req.body?.unit || null;
  const subjects = unit ? cfg.subjects.filter((s) => s.unit === unit) : cfg.subjects;
  if (!subjects.length) return res.status(400).json({ error: 'Matière inconnue' });
  // Abandon any unfinished exam of this course.
  db.prepare("DELETE FROM exams WHERE user_id = ? AND course_id = ? AND finished_at IS NULL").run(req.user.id, course.id);
  const questions = [];
  for (const s of subjects) {
    const pool = shuffle(unitQuestions(course, s.unit)).slice(0, s.questions);
    for (const q of pool) {
      const order = shuffle(q.choices.map((_, i) => i));
      questions.push({ qid: q.id, skill_id: q.skill_id, unit: s.unit, subject: s.title, q: q.q, choices: order.map((i) => q.choices[i]), answer: order.indexOf(q.answer), explanation: q.explanation });
    }
  }
  const limit = subjects.reduce((t, s) => t + s.minutes, 0) * 60;
  const info = db.prepare('INSERT INTO exams (user_id, course_id, mode, unit_id, time_limit_seconds, questions_json) VALUES (?, ?, ?, ?, ?, ?)')
    .run(req.user.id, course.id, unit ? 'subject' : 'full', unit, limit, JSON.stringify(questions));
  res.status(201).json(examView(db.prepare('SELECT * FROM exams WHERE id = ?').get(info.lastInsertRowid)));
});

function ownExam(req) {
  return db.prepare('SELECT * FROM exams WHERE id = ? AND user_id = ? AND course_id = ?').get(Number(req.params.examId), req.user.id, req.params.courseId);
}

r.get('/:courseId/:examId', (req, res) => {
  const exam = ownExam(req);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  res.json(examView(exam));
});

/** Autosave of the answers while the exam is running. */
r.put('/:courseId/:examId/answers', (req, res) => {
  const exam = ownExam(req);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  if (exam.finished_at) return res.status(409).json({ error: 'Examen déjà terminé' });
  const count = JSON.parse(exam.questions_json).length;
  db.prepare('UPDATE exams SET answers_json = ? WHERE id = ?').run(JSON.stringify(cleanAnswers(req.body?.answers, count)), exam.id);
  res.json({ ok: true, remaining_seconds: Math.max(0, exam.time_limit_seconds - elapsedSeconds(exam)) });
});

/** Submit: grade per subject (pass mark per subject), award XP, return the full correction. */
r.post('/:courseId/:examId/submit', (req, res) => {
  const course = getCourse(req.params.courseId);
  const exam = ownExam(req);
  if (!course || !exam) return res.status(404).json({ error: 'Examen introuvable' });
  if (exam.finished_at) return res.json(examView(exam));
  const count = JSON.parse(exam.questions_json).length;
  const answers = req.body?.answers ? cleanAnswers(req.body.answers, count) : JSON.parse(exam.answers_json || '{}');
  const result = grade(course, exam, answers);
  const xp = Math.min(60, Math.round(result.correct / 2)) + (result.passed ? 10 : 0);
  db.transaction(() => {
    db.prepare("UPDATE exams SET answers_json = ?, results_json = ?, correct = ?, total = ?, passed = ?, finished_at = datetime('now') WHERE id = ?")
      .run(JSON.stringify(answers), JSON.stringify(result), result.correct, result.total, result.passed ? 1 : 0, exam.id);
    if (xp > 0) db.prepare("INSERT INTO xp_log (user_id, course_id, skill_id, kind, xp, correct, total, date) VALUES (?, ?, NULL, 'exam', ?, ?, ?, ?)").run(req.user.id, course.id, xp, result.correct, result.total, today());
    // Missed questions feed the targeted practice of their lesson.
    const ins = db.prepare(`INSERT INTO mistakes (user_id, course_id, skill_id, term) VALUES (?, ?, ?, ?) ON CONFLICT(user_id, course_id, skill_id, term) DO UPDATE SET count = count + 1, last_at = datetime('now')`);
    JSON.parse(exam.questions_json).forEach((q, i) => { if (answers[i] !== q.answer && q.skill_id) ins.run(req.user.id, course.id, q.skill_id, q.qid); });
  })();
  res.json({ ...examView(db.prepare('SELECT * FROM exams WHERE id = ?').get(exam.id)), xp });
});

r.delete('/:courseId/:examId', (req, res) => {
  const exam = ownExam(req);
  if (!exam) return res.status(404).json({ error: 'Examen introuvable' });
  db.prepare('DELETE FROM exams WHERE id = ?').run(exam.id);
  res.json({ ok: true });
});

export default r;
