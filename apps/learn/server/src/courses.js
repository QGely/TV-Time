import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.COURSES_DIR || path.join(__dirname, 'data', 'courses');
export const LEVELS_PER_SKILL = 3;

let cache = null;

function sanitizeQuestion(q, skillId, i) {
  if (!q || !q.q || !Array.isArray(q.choices) || q.choices.length < 2) return null;
  const choices = q.choices.map((c) => String(c).trim()).filter(Boolean);
  const answer = Number(q.answer);
  if (choices.length !== q.choices.length || !Number.isInteger(answer) || answer < 0 || answer >= choices.length) return null;
  return { id: String(q.id || `${skillId}q${String(i + 1).padStart(2, '0')}`), q: String(q.q).trim(), choices, answer, explanation: q.explanation ? String(q.explanation).trim() : null };
}

function sanitizeSkill(s, unitIndex, skillIndex) {
  const id = s.id || `u${unitIndex + 1}s${skillIndex + 1}`;
  const vocab = (Array.isArray(s.vocab) ? s.vocab : []).filter((v) => v && v.term && v.translation).map((v) => ({ term: String(v.term).trim(), translation: String(v.translation).trim(), emoji: v.emoji && String(v.emoji).trim() ? String(v.emoji).trim() : null }));
  const sentences = (Array.isArray(s.sentences) ? s.sentences : []).filter((x) => x && x.source && x.target).map((x) => ({ source: String(x.source).trim(), target: String(x.target).trim() }));
  const questions = (Array.isArray(s.questions) ? s.questions : []).map((q, i) => sanitizeQuestion(q, id, i)).filter(Boolean);
  // Schémas de la fiche : SVG original (sans script) ou image publiée à côté de l'appli (src relatif).
  const figures = (Array.isArray(s.figures) ? s.figures : []).filter((f) => f && f.title && ((typeof f.svg === 'string' && /^\s*<svg[\s>]/.test(f.svg) && !/<script|\son\w+\s*=/i.test(f.svg)) || (typeof f.src === 'string' && /^[\w./-]+\.(png|jpe?g|webp|svg)$/i.test(f.src) && !f.src.includes('..'))))
    .map((f) => ({ title: String(f.title), svg: f.svg || null, src: f.src || null, caption: f.caption ? String(f.caption) : '', credit: f.credit ? String(f.credit) : '' }));
  return { id, title: s.title || `Leçon ${skillIndex + 1}`, icon: s.icon || '📘', tips: s.tips || null, vocab, sentences, questions, figures, levels: LEVELS_PER_SKILL };
}

const META_KEYS = ['title', 'lang_name', 'flag', 'tts_lang', 'description', 'type', 'unlock', 'library', 'disclaimer', 'exam'];

/** Loads courses; "<id>.part<N>.json" files are merged into one course by id (units concatenated, lessons of a repeated unit appended). */
export function loadCourses() {
  if (cache) return cache;
  const byId = new Map();
  if (fs.existsSync(DIR)) {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const f of files) {
      let c;
      try { c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { console.error('[courses] fichier invalide', f, e.message); continue; }
      if (!c?.id) continue;
      if (!byId.has(c.id)) byId.set(c.id, { id: c.id, title: c.id, lang_name: '', flag: '📘', tts_lang: null, description: '', type: 'language', unlock: 'course', library: null, disclaimer: null, exam: null, units: [] });
      const course = byId.get(c.id);
      // Metadata may live in any file of the course (typically "<id>.json"); the first non-empty value wins.
      for (const k of META_KEYS) {
        if (c[k] === undefined || c[k] === null || c[k] === '') continue;
        const isDefault = course[k] === null || course[k] === '' || (k === 'title' && course.title === c.id) || (k === 'flag' && course.flag === '📘') || (k === 'type' && course.type === 'language') || (k === 'unlock' && course.unlock === 'course');
        if (isDefault) course[k] = c[k];
      }
      for (const u of Array.isArray(c.units) ? c.units : []) {
        const existing = course.units.find((x) => x.id === u.id);
        if (existing) {
          // Additional files may add lessons to a unit declared elsewhere (e.g. "lapl.part1b.json").
          const ui = course.units.indexOf(existing);
          for (const s of u.skills || []) {
            const sk = sanitizeSkill(s, ui, existing.skills.length);
            if (!existing.skills.some((x) => x.id === sk.id) && (sk.vocab.length >= 4 || sk.questions.length >= 4)) existing.skills.push(sk);
          }
          continue;
        }
        const unitIndex = course.units.length;
        course.units.push({ id: u.id || `u${unitIndex + 1}`, title: u.title || `Unité ${unitIndex + 1}`, description: u.description || '', color: /^#[0-9a-fA-F]{6}$/.test(u.color || '') ? u.color : ['#58cc02', '#1cb0f6', '#ce82ff', '#ff9600', '#ff4b4b', '#2b70c9'][unitIndex % 6], skills: (u.skills || []).map((s, i) => sanitizeSkill(s, unitIndex, i)).filter((s) => s.vocab.length >= 4 || s.questions.length >= 4) });
      }
    }
  }
  for (const c of byId.values()) {
    if (c.type !== 'quiz' && c.units.some((u) => u.skills.some((k) => k.questions.length))) c.type = 'quiz';
    if (!['unit', 'course'].includes(c.unlock)) c.unlock = 'course';
    c.units = c.units.filter((u) => u.skills.length);
    const skillNum = (k) => { const m = String(k.id).match(/^u\d+s(\d+)$/); return m ? Number(m[1]) : Infinity; };
    for (const u of c.units) u.skills.sort((a, b) => skillNum(a) - skillNum(b));
    // Keep units in the order declared by the exam (if any), otherwise by unit id number.
    const order = (u) => { const i = (c.exam?.subjects || []).findIndex((x) => x.unit === u.id); return i >= 0 ? i : 100 + (Number(String(u.id).replace(/\D/g, '')) || 0); };
    c.units.sort((a, b) => order(a) - order(b));
    c.question_count = c.units.reduce((s, u) => s + u.skills.reduce((t, k) => t + k.questions.length, 0), 0);
    c.skill_count = c.units.reduce((s, u) => s + u.skills.length, 0);
    c.word_count = c.units.reduce((s, u) => s + u.skills.reduce((t, k) => t + k.vocab.length, 0), 0);
  }
  cache = [...byId.values()].filter((c) => c.units.length);
  return cache;
}

export function reloadCourses() { cache = null; return loadCourses(); }
export function getCourse(id) { return loadCourses().find((c) => c.id === id) || null; }
export function getSkill(course, skillId) {
  for (const u of course.units) for (const s of u.skills) if (s.id === skillId) return { unit: u, skill: s };
  return null;
}
/** All questions of a unit, with the skill they come from. */
export function unitQuestions(course, unitId) {
  const u = course.units.find((x) => x.id === unitId);
  if (!u) return [];
  return u.skills.flatMap((s) => s.questions.map((q) => ({ ...q, skill_id: s.id, unit_id: u.id })));
}

/** Flat ordered list of skills (path order). */
export function skillPath(course) {
  const out = [];
  for (const u of course.units) for (const s of u.skills) out.push({ unit: u, skill: s });
  return out;
}
