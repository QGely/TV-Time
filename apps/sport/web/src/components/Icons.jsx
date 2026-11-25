const base = { fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', viewBox: '0 0 24 24', width: 20, height: 20 };
export const Icon = {
  Home: (p) => <svg {...base} {...p}><path d="M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-7H9v7H5a2 2 0 0 1-2-2z"/></svg>,
  Dumbbell: (p) => <svg {...base} {...p}><path d="M6 5v14M18 5v14M3 8v8M21 8v8M6 12h12"/></svg>,
  List: (p) => <svg {...base} {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/></svg>,
  Calendar: (p) => <svg {...base} {...p}><rect x="3" y="4" width="18" height="18" rx="3"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>,
  Chart: (p) => <svg {...base} {...p}><path d="M3 3v18h18"/><path d="M7 15l4-5 3 3 5-7"/></svg>,
  User: (p) => <svg {...base} {...p}><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg>,
  Check: (p) => <svg {...base} strokeWidth={3} {...p}><path d="M5 12l5 5L20 7"/></svg>,
  Plus: (p) => <svg {...base} {...p}><path d="M12 5v14M5 12h14"/></svg>,
  Minus: (p) => <svg {...base} {...p}><path d="M5 12h14"/></svg>,
  Search: (p) => <svg {...base} {...p}><circle cx="11" cy="11" r="7"/><path d="M21 21l-4.3-4.3"/></svg>,
  X: (p) => <svg {...base} {...p}><path d="M18 6L6 18M6 6l12 12"/></svg>,
  Back: (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  ChevronDown: (p) => <svg {...base} {...p}><path d="M6 9l6 6 6-6"/></svg>,
  ChevronRight: (p) => <svg {...base} {...p}><path d="M9 18l6-6-6-6"/></svg>,
  ChevronLeft: (p) => <svg {...base} {...p}><path d="M15 18l-6-6 6-6"/></svg>,
  Play: (p) => <svg {...base} {...p}><path d="M6 4l14 8-14 8z"/></svg>,
  Clock: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>,
  Settings: (p) => <svg {...base} {...p}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/></svg>,
  Trash: (p) => <svg {...base} {...p}><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v6M14 11v6"/></svg>,
  Edit: (p) => <svg {...base} {...p}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/></svg>,
  Logout: (p) => <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>,
  Flame: (p) => <svg {...base} {...p}><path d="M12 22c4.4 0 7-3 7-7 0-3-2-5-3-6-.5 2-2 3-2 3 0-3-1-6-4-9 0 4-3 6-4 9-1 2-1 3-1 3 0 4 2.6 7 7 7z"/></svg>,
  Trophy: (p) => <svg {...base} {...p}><path d="M8 21h8M12 17v4M6 3h12v6a6 6 0 0 1-12 0zM6 5H3v2a3 3 0 0 0 3 3M18 5h3v2a3 3 0 0 1-3 3"/></svg>,
  Repeat: (p) => <svg {...base} {...p}><path d="M17 1l4 4-4 4"/><path d="M3 11V9a4 4 0 0 1 4-4h14M7 23l-4-4 4-4"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  Scale: (p) => <svg {...base} {...p}><path d="M12 3v18M5 7l7-4 7 4M3 15l2-8 2 8a2 2 0 0 1-4 0zM17 15l2-8 2 8a2 2 0 0 1-4 0z"/></svg>,
  Book: (p) => <svg {...base} {...p}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5V4.5A2.5 2.5 0 0 1 6.5 2H20v15H6.5A2.5 2.5 0 0 0 4 19.5z"/></svg>,
  Stop: (p) => <svg {...base} {...p}><rect x="5" y="5" width="14" height="14" rx="2"/></svg>,
  Users: (p) => <svg {...base} {...p}><circle cx="9" cy="8" r="4"/><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-5-6.7"/></svg>,
};
export function Logo({ size = 22 }) {
  return <svg viewBox="0 0 64 64" width={size} height={size}><path d="M10 26h6v12h-6zM48 26h6v12h-6zM16 22h6v20h-6zM42 22h6v20h-6zM22 29h20v6H22z" fill="#1a0b06" /></svg>;
}
