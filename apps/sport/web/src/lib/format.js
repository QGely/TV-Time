export function fmtDate(str, style = 'full') {
  if (!str) return '';
  const d = /^\d{4}-\d{2}-\d{2}$/.test(str) ? new Date(str + 'T12:00:00') : new Date(str.replace(' ', 'T') + (str.length > 10 && !str.endsWith('Z') ? 'Z' : ''));
  if (Number.isNaN(d.getTime())) return '';
  const opts = { full: { day: 'numeric', month: 'long', year: 'numeric' }, long: { weekday: 'long', day: 'numeric', month: 'long' }, short: { day: 'numeric', month: 'short' }, time: { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }, month: { month: 'long', year: 'numeric' } }[style];
  return new Intl.DateTimeFormat('fr-FR', opts).format(d);
}
export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function timeAgo(str) {
  if (!str) return '';
  const d = new Date(str.replace(' ', 'T') + 'Z');
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 3600) return `il y a ${Math.max(1, Math.floor(diff / 60))} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return fmtDate(str, 'short');
}
export function mmss(seconds) {
  const s = Math.max(0, Math.round(seconds || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h ? `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}` : `${m}:${String(sec).padStart(2, '0')}`;
}
export function minutesText(min) {
  const m = Math.round(min || 0);
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return `${h} h${m % 60 ? ` ${String(m % 60).padStart(2, '0')}` : ''}`;
}
export function kg(v, unit = 'kg') {
  if (v === null || v === undefined) return '—';
  if (unit === 'lb') return `${Math.round(v * 2.20462 * 10) / 10} lb`;
  return `${Math.round(v * 10) / 10} kg`;
}
export function volumeText(v) {
  if (v >= 1000) return `${(v / 1000).toFixed(1).replace('.0', '')} t`;
  return `${Math.round(v)} kg`;
}
export function distanceText(m) {
  if (!m) return '—';
  return m >= 1000 ? `${(m / 1000).toFixed(2)} km` : `${Math.round(m)} m`;
}
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
export const AVATARS = ['💪', '🏃', '🚴', '🏋️', '🧘', '🥊', '⚽', '🏊', '🦁', '🐺', '🔥', '⚡'];
export function initials(name) { return (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(); }
export const CATEGORY_ICONS = { jambes: '🦵', pectoraux: '🫁', dos: '🔙', epaules: '🤷', bras: '💪', abdos: '🎯', cardio: '❤️', 'full-body': '🏋️', etirements: '🧘' };
export const MOODS = [['😫', 'Épuisé'], ['😐', 'Moyen'], ['🙂', 'Bien'], ['😄', 'Super'], ['🔥', 'En feu']];
