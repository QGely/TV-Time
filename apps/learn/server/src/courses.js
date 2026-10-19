import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIR = process.env.COURSES_DIR || path.join(__dirname, 'data', 'courses');
export const LEVELS_PER_SKILL = 3;

let cache = null;

function sanitizeSkill(s, unitIndex, skillIndex) {
  const vocab = (Array.isArray(s.vocab) ? s.vocab : []).filter((v) => v && v.term && v.translation).map((v) => ({ term: String(v.term).trim(), translation: String(v.translation).trim(), emoji: v.emoji && String(v.emoji).trim() ? String(v.emoji).trim() : null }));
  const sentences = (Array.isArray(s.sentences) ? s.sentences : []).filter((x) => x && x.source && x.target).map((x) => ({ source: String(x.source).trim(), target: String(x.target).trim() }));
  return { id: s.id || `u${unitIndex + 1}s${skillIndex + 1}`, title: s.title || `Leçon ${skillIndex + 1}`, icon: s.icon || '📘', tips: s.tips || null, vocab, sentences, levels: LEVELS_PER_SKILL };
}

/** Loads courses; "<id>.part<N>.json" files are merged into one course by id (units concatenated). */
export function loadCourses() {
  if (cache) return cache;
  const byId = new Map();
  if (fs.existsSync(DIR)) {
    const files = fs.readdirSync(DIR).filter((f) => f.endsWith('.json')).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
    for (const f of files) {
      let c;
      try { c = JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8')); } catch (e) { console.error('[courses] fichier invalide', f, e.message); continue; }
      if (!c?.id || !Array.isArray(c.units)) continue;
      if (!byId.has(c.id)) byId.set(c.id, { id: c.id, title: c.title || c.id, lang_name: c.lang_name || '', flag: c.flag || '📘', tts_lang: c.tts_lang || null, description: c.description || '', units: [] });
      const course = byId.get(c.id);
      for (const u of c.units) {
        if (course.units.some((x) => x.id === u.id)) continue;
        const unitIndex = course.units.length;
        course.units.push({ id: u.id || `u${unitIndex + 1}`, title: u.title || `Unité ${unitIndex + 1}`, description: u.description || '', color: /^#[0-9a-fA-F]{6}$/.test(u.color || '') ? u.color : ['#58cc02', '#1cb0f6', '#ce82ff', '#ff9600', '#ff4b4b', '#2b70c9'][unitIndex % 6], skills: (u.skills || []).map((s, i) => sanitizeSkill(s, unitIndex, i)).filter((s) => s.vocab.length >= 4) });
      }
    }
  }
  for (const c of byId.values()) {
    c.units = c.units.filter((u) => u.skills.length);
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
/** Flat ordered list of skills (path order). */
export function skillPath(course) {
  const out = [];
  for (const u of course.units) for (const s of u.skills) out.push({ unit: u, skill: s });
  return out;
}
