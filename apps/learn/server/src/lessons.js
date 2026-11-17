import { getSkill, skillPath } from './courses.js';

function shuffle(arr, rng = Math.random) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}
const pick = (arr, n, rng) => shuffle(arr, rng).slice(0, n);
const words = (s) => s.replace(/[.,!?;:¿¡«»"]/g, ' ').split(/\s+/).filter(Boolean);

/** Vocabulary available for distractors: this skill + earlier skills of the course. */
function poolFor(course, skillId) {
  const path = skillPath(course);
  const idx = path.findIndex((p) => p.skill.id === skillId);
  const earlier = path.slice(0, Math.max(0, idx)).flatMap((p) => p.skill.vocab);
  const sentences = path.slice(0, idx + 1).flatMap((p) => p.skill.sentences);
  return { earlier, sentences };
}

/**
 * Builds a lesson of ~10 exercises for a skill/level, Duolingo style.
 * level 1: recognition (choose, match), level 2: adds fill/arrange, level 3: adds typing and listening.
 */
export function buildLesson(course, skillId, level, { practice = false, weakTerms = [] } = {}) {
  const found = getSkill(course, skillId);
  if (!found) return null;
  const { skill } = found;
  if (skill.questions.length) return buildQuizLesson(course, skill, level, { practice, weakTerms });
  const { earlier, sentences } = poolFor(course, skillId);
  const vocab = skill.vocab;
  const allVocab = [...vocab, ...earlier];
  const rng = Math.random;
  const exercises = [];
  const lang = course.lang_name;

  const distractors = (item, n, key) => pick(allVocab.filter((v) => v[key] !== item[key]), n, rng).map((v) => v[key]);

  const chooseToFr = (v) => ({ type: 'choose', prompt: `Que signifie « ${v.term} » ?`, term: v.term, speak: v.term, options: shuffle([v.translation, ...distractors(v, 3, 'translation')], rng), answer: v.translation, emoji: v.emoji });
  const chooseToLang = (v) => ({ type: 'choose', prompt: `Comment dit-on « ${v.translation} » en ${lang} ?`, term: v.translation, options: shuffle([v.term, ...distractors(v, 3, 'term')], rng), answer: v.term, emoji: v.emoji, speakAnswer: true });
  const typeToLang = (v) => ({ type: 'type', prompt: `Écris en ${lang} : « ${v.translation} »`, term: v.translation, answer: v.term, accept: [v.term], emoji: v.emoji, speakAnswer: true });
  const typeToFr = (v) => ({ type: 'type', prompt: `Traduis en français : « ${v.term} »`, term: v.term, speak: v.term, answer: v.translation, accept: [v.translation], emoji: v.emoji });
  const listen = (v) => ({ type: 'listen', prompt: 'Écris ce que tu entends', speak: v.term, answer: v.term, accept: [v.term], hint: v.translation });
  const match = (items) => ({ type: 'match', prompt: 'Associe les paires', pairs: items.map((v) => ({ a: v.term, b: v.translation })) });
  const arrange = (s) => {
    const target = words(s.source);
    const low = new Set(target.map((w) => w.toLowerCase()));
    const extra = [...new Set(pick(allVocab.map((v) => words(v.term)[0]).filter((w) => w && !low.has(w.toLowerCase())), 6, rng).map((w) => w.toLowerCase()))].slice(0, Math.min(3, Math.max(1, 6 - target.length)));
    return { type: 'arrange', prompt: `Traduis en ${lang} : « ${s.target} »`, term: s.target, bank: shuffle([...target, ...extra], rng), answer: s.source, accept: [s.source], speakAnswer: true };
  };
  const arrangeFr = (s) => {
    const target = words(s.target);
    const low = new Set(target.map((w) => w.toLowerCase()));
    const extra = [...new Set(pick(allVocab.map((v) => words(v.translation)[0]).filter((w) => w && !low.has(w.toLowerCase())), 6, rng).map((w) => w.toLowerCase()))].slice(0, Math.min(3, Math.max(1, 6 - target.length)));
    return { type: 'arrange', prompt: `Traduis en français : « ${s.source} »`, term: s.source, speak: s.source, bank: shuffle([...target, ...extra], rng), answer: s.target, accept: [s.target] };
  };
  const fill = (s) => {
    const ws = words(s.source);
    if (ws.length < 3) return null;
    const i = Math.floor(rng() * ws.length);
    const missing = ws[i];
    const blanked = s.source.replace(new RegExp(`(^|[^\\p{L}])${missing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?=$|[^\\p{L}])`, 'u'), '$1____');
    if (!blanked.includes('____')) return null;
    const opts = pick(allVocab.map((v) => words(v.term)[0]).filter((w) => w && w.toLowerCase() !== missing.toLowerCase()), 2, rng);
    return { type: 'fill', prompt: 'Complète la phrase', term: blanked, hint: s.target, options: shuffle([missing, ...opts], rng), answer: missing };
  };

  const focus = weakTerms.length ? vocab.filter((v) => weakTerms.includes(v.term)) : [];
  const vocabOrder = shuffle([...focus, ...vocab.filter((v) => !focus.includes(v))], rng);
  const sents = shuffle(skill.sentences.length ? skill.sentences : sentences, rng);
  const lv = practice ? 2 : level;

  // Warm-up: recognition of new words
  for (const v of vocabOrder.slice(0, 3)) exercises.push(lv >= 3 ? chooseToLang(v) : chooseToFr(v));
  if (vocab.length >= 4) exercises.push(match(pick(vocab, Math.min(5, vocab.length), rng)));
  for (const v of vocabOrder.slice(3, 5)) exercises.push(lv >= 2 ? chooseToLang(v) : chooseToFr(v));
  if (sents[0]) exercises.push(lv >= 2 ? arrange(sents[0]) : arrangeFr(sents[0]));
  if (lv >= 2 && sents[1]) { const f = fill(sents[1]); exercises.push(f || arrangeFr(sents[1])); }
  if (lv >= 3) { for (const v of vocabOrder.slice(5, 7)) exercises.push(typeToLang(v)); if (course.tts_lang) exercises.push(listen(vocabOrder[0])); }
  else for (const v of vocabOrder.slice(5, 6)) exercises.push(typeToFr(v));
  if (sents[2]) exercises.push(lv >= 2 ? arrange(sents[2]) : arrangeFr(sents[2]));
  if (lv >= 2 && sents[3]) exercises.push(arrangeFr(sents[3]));
  if (vocab.length >= 6) exercises.push(match(pick(vocab, 5, rng)));

  return { course_id: course.id, skill_id: skill.id, skill_title: skill.title, level: lv, practice, tts_lang: course.tts_lang, tips: skill.tips, exercises: exercises.filter(Boolean).slice(0, 12).map((e, i) => ({ id: i + 1, ...e })) };
}

/** Shuffles the choices of a bank question; returns an exercise with the new answer index. */
export function qcmExercise(q, rng = Math.random) {
  const order = shuffle(q.choices.map((_, i) => i), rng);
  return { type: 'qcm', qid: q.id, prompt: q.q, options: order.map((i) => q.choices[i]), answer: q.choices[q.answer], explanation: q.explanation };
}

/**
 * Quiz (QCM) lesson: the skill's question bank is split in thirds by level so each level brings new
 * questions; level 3 and practice mix everything, starting with previously missed questions.
 * A glossary "match" exercise opens and closes the lesson when the skill has a glossary.
 */
function buildQuizLesson(course, skill, level, { practice, weakTerms }) {
  const rng = Math.random;
  const bank = skill.questions;
  const third = Math.ceil(bank.length / 3);
  const lv = Math.max(1, Math.min(3, level));
  let pool;
  if (practice || lv >= 3) pool = shuffle(bank, rng);
  else {
    const fresh = bank.slice((lv - 1) * third, lv * third);
    const earlier = bank.slice(0, (lv - 1) * third);
    pool = [...shuffle(fresh, rng), ...shuffle(earlier, rng), ...shuffle(bank.slice(lv * third), rng)];
  }
  const weak = bank.filter((q) => weakTerms.includes(q.id));
  const picked = [];
  for (const q of [...shuffle(weak, rng), ...pool]) { if (picked.length >= 10) break; if (!picked.includes(q)) picked.push(q); }
  const exercises = picked.map((q) => qcmExercise(q, rng));
  if (skill.vocab.length >= 4) {
    const glossary = skill.vocab.map((v) => ({ a: v.term, b: v.translation }));
    exercises.splice(Math.min(3, exercises.length), 0, { type: 'match', prompt: 'Associe chaque terme à sa définition', pairs: pick(glossary, Math.min(4, glossary.length), rng) });
  }
  return { course_id: course.id, skill_id: skill.id, skill_title: skill.title, level: practice ? Math.max(1, level) : lv, practice, tts_lang: null, tips: skill.tips, exercises: exercises.map((e, i) => ({ id: i + 1, ...e })) };
}
