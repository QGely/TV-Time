import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { db } from './db.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.join(__dirname, 'data');

export const MUSCLES = {
  chest: 'Pectoraux', front_delts: 'Deltoïdes antérieurs', side_delts: 'Deltoïdes latéraux', rear_delts: 'Deltoïdes postérieurs',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', abs: 'Abdominaux', obliques: 'Obliques', quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets', lats: 'Grand dorsal', traps: 'Trapèzes',
  lower_back: 'Lombaires', upper_back: 'Haut du dos', hip_flexors: 'Fléchisseurs de hanche', adductors: 'Adducteurs',
  abductors: 'Abducteurs', neck: 'Cou',
};
export const CATEGORIES = {
  jambes: 'Jambes', pectoraux: 'Pectoraux', dos: 'Dos', epaules: 'Épaules', bras: 'Bras', abdos: 'Abdos', cardio: 'Cardio',
  'full-body': 'Full body', etirements: 'Étirements',
};
export const EQUIPMENT = {
  barre: 'Barre', halteres: 'Haltères', 'poids-du-corps': 'Poids du corps', machine: 'Machine', kettlebell: 'Kettlebell',
  elastique: 'Élastique', poulie: 'Poulie', tapis: 'Tapis de course', velo: 'Vélo', corde: 'Corde à sauter', aucun: 'Aucun',
};
export const LEVELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };

const MUSCLE_IDS = new Set(Object.keys(MUSCLES));
let cache = null;

function sanitize(e, source) {
  if (!e || typeof e.id !== 'string' || typeof e.name !== 'string') return null;
  const muscles = (arr) => (Array.isArray(arr) ? arr.filter((m) => MUSCLE_IDS.has(m)) : []);
  return {
    id: e.id,
    name: e.name,
    name_en: e.name_en || null,
    category: CATEGORIES[e.category] ? e.category : 'full-body',
    equipment: EQUIPMENT[e.equipment] ? e.equipment : 'aucun',
    type: ['strength', 'cardio', 'stretch'].includes(e.type) ? e.type : 'strength',
    unit: ['reps', 'time', 'distance'].includes(e.unit) ? e.unit : 'reps',
    level: LEVELS[e.level] ? e.level : 'debutant',
    primary_muscles: muscles(e.primary_muscles),
    secondary_muscles: muscles(e.secondary_muscles),
    instructions: Array.isArray(e.instructions) ? e.instructions.map(String) : [],
    tips: e.tips || null,
    mistakes: Array.isArray(e.mistakes) ? e.mistakes.map(String) : [],
    source,
    user_id: e.user_id || null,
  };
}

/** Bundled exercises (all JSON files in data/exercises), cached. */
export function bundledExercises() {
  if (cache) return cache;
  const dir = path.join(DATA, 'exercises');
  const out = new Map();
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const e of Array.isArray(arr) ? arr : []) {
          const s = sanitize(e, 'bundled');
          if (s && !out.has(s.id)) out.set(s.id, s);
        }
      } catch (err) {
        console.error('[exercises] fichier invalide', f, err.message);
      }
    }
  }
  cache = out;
  return out;
}

export function reloadLibrary() {
  cache = null;
  programsCache = null;
}

/** All exercises visible to a user: bundled + that user's custom ones. */
export function exercisesFor(userId) {
  const map = new Map(bundledExercises());
  const rows = db.prepare('SELECT * FROM custom_exercises WHERE user_id = ?').all(userId);
  for (const row of rows) {
    try {
      const s = sanitize({ ...JSON.parse(row.json), id: row.id, user_id: row.user_id }, 'custom');
      if (s) map.set(s.id, s);
    } catch {}
  }
  return map;
}

export function getExercise(userId, id) {
  return exercisesFor(userId).get(id) || null;
}

let programsCache = null;
export function bundledPrograms() {
  if (programsCache) return programsCache;
  const dir = path.join(DATA, 'programs');
  const out = [];
  if (fs.existsSync(dir)) {
    for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.json')).sort()) {
      try {
        const arr = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'));
        for (const p of Array.isArray(arr) ? arr : []) {
          if (!p?.id || !Array.isArray(p.days)) continue;
          out.push({
            id: p.id, name: p.name, description: p.description || '', level: LEVELS[p.level] ? p.level : 'debutant',
            goal: p.goal || 'muscle', days_per_week: p.days_per_week || p.days.length, weeks: p.weeks || 8, icon: p.icon || '🏋️',
            days: p.days.map((d, i) => ({
              name: d.name || `Jour ${i + 1}`, focus: d.focus || '',
              exercises: (d.exercises || []).map((x) => ({ exercise_id: x.exercise_id, sets: Number(x.sets) || 3, reps: String(x.reps || '10'), rest_seconds: Number(x.rest_seconds) || 90, notes: x.notes || null })),
            })),
          });
        }
      } catch (err) {
        console.error('[programs] fichier invalide', f, err.message);
      }
    }
  }
  programsCache = out;
  return out;
}

/** Estimated one-rep max (Epley). */
export function e1rm(weight, reps) {
  if (!weight || !reps) return 0;
  if (reps === 1) return weight;
  return Math.round(weight * (1 + reps / 30) * 10) / 10;
}

export function setVolume(set) {
  if (!set.done) return 0;
  if (set.weight && set.reps) return set.weight * set.reps;
  return 0;
}
