const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2.4, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', width: 22, height: 22 };
export const Icon = {
  Home: (p) => <svg {...base} {...p}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>,
  Dumbbell: (p) => <svg {...base} {...p}><path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12"/></svg>,
  Trophy: (p) => <svg {...base} {...p}><path d="M8 21h8M12 17v4M6 3h12v6a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/></svg>,
  User: (p) => <svg {...base} {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  Settings: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  Check: (p) => <svg {...base} strokeWidth={3.2} {...p}><path d="M5 12l5 5L20 7"/></svg>,
  X: (p) => <svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Lock: (p) => <svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>,
  Star: (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>,
  Crown: (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M3 18h18l1-11-5.5 4L12 4l-4.5 7L2 7z"/></svg>,
  Speaker: (p) => <svg {...base} {...p}><path d="M11 5L6 9H2v6h4l5 4z"/><path d="M15.5 8.5a5 5 0 0 1 0 7M19 5a9 9 0 0 1 0 14"/></svg>,
  Heart: (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>,
  Flame: (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M12 22c4.4 0 7-3 7-7 0-3-2-5-3-6-.5 2-2 3-2 3 0-3-1-6-4-9 0 4-3 6-4 9-1 2-1 3-1 3 0 4 2.6 7 7 7z"/></svg>,
  Book: (p) => <svg {...base} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/></svg>,
  Back: (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  Logout: (p) => <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Trash: (p) => <svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>,
  Globe: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/></svg>,
  Zap: (p) => <svg {...base} fill="currentColor" stroke="none" {...p}><path d="M13 2L3 14h8l-1 8 10-12h-8z"/></svg>,
};
export function Logo({ size = 26 }) {
  return <svg viewBox="0 0 64 64" width={size} height={size}><circle cx="32" cy="30" r="15" fill="#fff"/><circle cx="26" cy="28" r="4" fill="#3c3c3c"/><circle cx="38" cy="28" r="4" fill="#3c3c3c"/><path d="M28 36q4 4 8 0" stroke="#3c3c3c" strokeWidth="2.5" fill="none" strokeLinecap="round"/><path d="M20 44h24v6H20z" fill="#fff"/></svg>;
}
