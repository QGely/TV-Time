export const AVATARS = ['🦉', '🦊', '🐼', '🐸', '🦁', '🐙', '🦄', '🐧', '🌟', '🚀', '🎓', '📚'];
export function initials(name) { return (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
export function bytes(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '—';
  const units = ['o', 'Ko', 'Mo', 'Go', 'To'];
  let i = 0, v = Number(n);
  while (v >= 1024 && i < units.length - 1) { v /= 1024; i++; }
  return `${v < 10 && i > 0 ? v.toFixed(1) : Math.round(v)} ${units[i]}`;
}
export function uptime(seconds) {
  const d = Math.floor(seconds / 86400), h = Math.floor((seconds % 86400) / 3600), m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d} j ${h} h`;
  if (h) return `${h} h ${m} min`;
  return `${m} min`;
}
export function fmtDate(str, style = 'short') {
  if (!str) return '';
  const d = new Date(str.length === 10 ? str + 'T12:00:00' : str.replace(' ', 'T') + 'Z');
  return new Intl.DateTimeFormat('fr-FR', style === 'short' ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
}

/** Lenient answer comparison: case/accent/punctuation-insensitive, 1 typo allowed on long answers. */
export function normalize(s) {
  return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, "'").replace(/[^\p{L}\p{N}' ]+/gu, ' ').replace(/\s+/g, ' ').trim();
}
function levenshtein(a, b) {
  if (a === b) return 0;
  const m = a.length, n = b.length;
  if (!m) return n; if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, i) => i);
  for (let i = 1; i <= m; i++) {
    const cur = [i];
    for (let j = 1; j <= n; j++) cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    prev = cur;
  }
  return prev[n];
}
export function checkAnswer(given, accepted) {
  const g = normalize(given);
  if (!g) return { ok: false, close: false };
  for (const a of accepted) {
    const n = normalize(a);
    if (g === n) return { ok: true, close: false };
    // Allow articles to be dropped: "le chat" vs "chat"
    const stripArt = (x) => x.replace(/^(le|la|les|l'|un|une|des|the|a|an|el|la|los|las|il|lo|gli|le|der|die|das|ein|eine) /, '');
    if (stripArt(g) === stripArt(n)) return { ok: true, close: true };
    if (n.length >= 5 && levenshtein(g, n) <= 1) return { ok: true, close: true };
  }
  return { ok: false, close: false };
}

let voicesReady = false;
export function speak(text, lang) {
  try {
    if (!('speechSynthesis' in window) || !text) return false;
    const u = new SpeechSynthesisUtterance(text);
    u.lang = lang || 'en-US';
    u.rate = 0.9;
    const voices = window.speechSynthesis.getVoices();
    const v = voices.find((x) => x.lang === u.lang) || voices.find((x) => x.lang.startsWith(u.lang.slice(0, 2)));
    if (v) u.voice = v;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(u);
    voicesReady = true;
    return true;
  } catch { return false; }
}
export function canSpeak() { return typeof window !== 'undefined' && 'speechSynthesis' in window; }
