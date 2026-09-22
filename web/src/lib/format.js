const IMG = 'https://image.tmdb.org/t/p/';

export function img(path, size = 'w342') {
  return path ? `${IMG}${size}${path}` : null;
}

export function epCode(ep) {
  if (!ep) return '';
  const s = String(ep.season_number).padStart(2, '0');
  const e = String(ep.episode_number).padStart(2, '0');
  return `S${s}E${e}`;
}

export function year(date) {
  return date ? date.slice(0, 4) : '';
}

const fmtLong = new Intl.DateTimeFormat('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
const fmtShort = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short' });
const fmtFull = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
const fmtTime = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

function toDate(str) {
  if (!str) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return new Date(str + 'T12:00:00');
  return new Date(str.replace(' ', 'T') + (str.endsWith('Z') || str.length <= 10 ? '' : 'Z'));
}

export function fmtDate(str, style = 'full') {
  const d = toDate(str);
  if (!d || Number.isNaN(d.getTime())) return '';
  if (style === 'long') return fmtLong.format(d);
  if (style === 'short') return fmtShort.format(d);
  if (style === 'time') return fmtTime.format(d);
  return fmtFull.format(d);
}

export function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function addDays(str, n) {
  const d = toDate(str);
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function relativeDay(dateStr) {
  if (!dateStr) return 'Date inconnue';
  const t = todayStr();
  const diff = Math.round((Date.parse(dateStr) - Date.parse(t)) / 864e5);
  if (diff === 0) return "Aujourd'hui";
  if (diff === 1) return 'Demain';
  if (diff === -1) return 'Hier';
  if (diff > 1 && diff < 7) return `Dans ${diff} jours`;
  if (diff < -1 && diff > -7) return `Il y a ${-diff} jours`;
  return fmtDate(dateStr, 'short');
}

export function timeAgo(str) {
  const d = toDate(str);
  if (!d) return '';
  const diff = (Date.now() - d.getTime()) / 1000;
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `il y a ${Math.floor(diff / 86400)} j`;
  return fmtDate(str, 'short');
}

/** TV Time style duration: "2 mois 3 jours 4 heures". */
export function duration(minutes) {
  const m = Math.max(0, Math.round(minutes || 0));
  const months = Math.floor(m / (60 * 24 * 30));
  const days = Math.floor((m % (60 * 24 * 30)) / (60 * 24));
  const hours = Math.floor((m % (60 * 24)) / 60);
  const mins = m % 60;
  return { months, days, hours, mins };
}

export function durationText(minutes) {
  const d = duration(minutes);
  const parts = [];
  if (d.months) parts.push(`${d.months} mois`);
  if (d.days) parts.push(`${d.days} j`);
  if (d.hours) parts.push(`${d.hours} h`);
  if (!parts.length || (!d.months && !d.days)) parts.push(`${d.mins} min`);
  return parts.join(' ');
}

export const REACTIONS = [
  { id: 'good', emoji: '👍', label: 'Bien' },
  { id: 'fun', emoji: '😂', label: 'Drôle' },
  { id: 'wow', emoji: '🤯', label: 'Wow' },
  { id: 'love', emoji: '❤️', label: 'Adoré' },
  { id: 'sad', emoji: '😢', label: 'Triste' },
  { id: 'bad', emoji: '👎', label: 'Bof' },
];

export function reactionEmoji(id) {
  return REACTIONS.find((r) => r.id === id)?.emoji || '';
}

export const STATUS_LABELS = {
  watching: 'En cours',
  up_to_date: 'À jour',
  not_started: 'Pas commencée',
  for_later: 'Pour plus tard',
  stopped: 'Arrêtée',
};

export const SHOW_STATUS_LABELS = {
  'Returning Series': 'En cours',
  Ended: 'Terminée',
  Canceled: 'Annulée',
  'In Production': 'En production',
  Planned: 'Prévue',
  Pilot: 'Pilote',
};

export const AVATARS = ['🍿', '📺', '🎬', '🦊', '🐼', '🦄', '👾', '🐙', '🌵', '🚀', '🎃', '🐸'];

export function initials(name) {
  return (name || '?').trim().split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase();
}
