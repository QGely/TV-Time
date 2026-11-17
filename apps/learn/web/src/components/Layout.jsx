import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Icon, Logo } from './Icons.jsx';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from './Avatar.jsx';
import { DiskGauge } from './DiskGauge.jsx';
import { useStatus } from '../lib/status.jsx';

function navLinks(status) {
  const quiz = status?.course_type === 'quiz';
  return [
    { to: '/', label: 'Apprendre', icon: Icon.Home, end: true },
    { to: '/practice', label: 'Réviser', icon: Icon.Dumbbell },
    ...(status?.has_exam ? [{ to: '/exam', label: 'Examen', icon: Icon.Exam }] : []),
    ...(status?.library ? [{ to: `/library/${status.library}`, label: 'Ressources', icon: Icon.Library }] : []),
    { to: '/leaderboard', label: 'Classement', icon: Icon.Trophy, desktopOnly: quiz },
    { to: '/profile', label: 'Profil', icon: Icon.User },
    { to: '/courses', label: 'Cours', icon: Icon.Globe, desktopOnly: true },
  ];
}

export function StatusBar() {
  const { status } = useStatus();
  if (!status) return null;
  return (
    <div className="status-bar">
      <NavLink to="/courses" className="status-item" title="Changer de cours"><span className="flag">{status.flag || '📘'}</span></NavLink>
      <span className={'status-item streak' + (status.streak?.active_today ? ' on' : '')} title="Série de jours"><Icon.Flame /> {status.streak?.current ?? 0}</span>
      <span className="status-item xp" title="XP aujourd'hui"><Icon.Zap /> {status.xp_today ?? 0}/{status.daily_goal ?? 20}</span>
      <span className="status-item hearts" title="Cœurs"><Icon.Heart /> {status.hearts?.hearts ?? 5}</span>
    </div>
  );
}

export function Layout() {
  const { user } = useAuth();
  const { status } = useStatus();
  const { pathname } = useLocation();
  const links = navLinks(status);
  const inLesson = pathname.startsWith('/lesson') || /^\/exam\/[^/]+\/\d+/.test(pathname);
  if (inLesson) return <main className="lesson-main"><Outlet /></main>;
  return (
    <div className="app">
      <nav className="sidenav">
        <NavLink to="/" className="brand"><span className="brand-logo"><Logo /></span><span className="brand-name">Apprendre</span></NavLink>
        {links.map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}><l.icon /> {l.label}</NavLink>)}
        <div className="spacer" />
        <DiskGauge />
        <NavLink to="/settings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}><Icon.Settings /> Paramètres</NavLink>
        <NavLink to="/settings" className="nav-user"><Avatar user={user} /><span className="grow ellipsis">{user?.display_name}</span></NavLink>
      </nav>
      <main className="main"><StatusBar /><Outlet /></main>
      <nav className="bottomnav">
        {links.filter((l) => !l.desktopOnly).map((l) => <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}><l.icon /> {l.label}</NavLink>)}
      </nav>
    </div>
  );
}
