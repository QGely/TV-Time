const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24' };

export const Icon = {
  Home: (p) => <svg {...base} {...p}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>,
  Compass: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="10"/><path d="M16 8l-2.5 6L8 16l2.5-6z"/></svg>,
  Calendar: (p) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Library: (p) => <svg {...base} {...p}><rect x="3" y="3" width="7" height="18" rx="1.5"/><rect x="14" y="3" width="7" height="18" rx="1.5"/></svg>,
  Film: (p) => <svg {...base} {...p}><rect x="2" y="3" width="20" height="18" rx="2.5"/><path d="M7 3v18M17 3v18M2 8h5M2 16h5M17 8h5M17 16h5M7 12h10"/></svg>,
  User: (p) => <svg {...base} {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  Check: (p) => <svg {...base} strokeWidth={3} {...p}><path d="M5 12l5 5L20 7"/></svg>,
  Plus: (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Search: (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  X: (p) => <svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Back: (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  ChevronDown: (p) => <svg {...base} {...p}><path d="M6 9l6 6 6-6"/></svg>,
  ChevronLeft: (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  ChevronRight: (p) => <svg {...base} {...p}><path d="M9 18l6-6-6-6"/></svg>,
  Star: (p) => <svg {...base} {...p}><path d="M12 2l3.1 6.3 6.9 1-5 4.9 1.2 6.8L12 17.8 5.8 21l1.2-6.8-5-4.9 6.9-1z"/></svg>,
  Heart: (p) => <svg {...base} {...p}><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>,
  Settings: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  Refresh: (p) => <svg {...base} {...p}><path d="M21 12a9 9 0 1 1-2.6-6.4M21 3v6h-6"/></svg>,
  Play: (p) => <svg {...base} {...p}><path d="M6 4l14 8-14 8z"/></svg>,
  Clock: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  Tv: (p) => <svg {...base} {...p}><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M17 2l-5 5-5-5"/></svg>,
  More: (p) => <svg {...base} {...p}><circle cx="5" cy="12" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="19" cy="12" r="1.5"/></svg>,
  Logout: (p) => <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Trash: (p) => <svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>,
  External: (p) => <svg {...base} {...p}><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6M15 3h6v6M10 14L21 3"/></svg>,
};

export function Logo({ size = 22 }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size}>
      <path d="M18 22h28a4 4 0 0 1 4 4v16a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4V26a4 4 0 0 1 4-4zm10 6v12l10-6-10-6zM24 12l8 8 8-8" fill="none" stroke="#15130a" strokeWidth="4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}
