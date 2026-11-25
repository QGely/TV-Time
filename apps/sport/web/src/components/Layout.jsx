import { NavLink, Outlet } from 'react-router-dom';
import { Icon, Logo } from './Icons.jsx';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from './Avatar.jsx';
import { DiskGauge } from './DiskGauge.jsx';

const links = [
  { to: '/', label: 'Accueil', icon: Icon.Home, end: true },
  { to: '/exercises', label: 'Exercices', icon: Icon.Dumbbell },
  { to: '/routines', label: 'Routines', icon: Icon.List },
  { to: '/programs', label: 'Programmes', icon: Icon.Book, desktopOnly: true },
  { to: '/history', label: 'Historique', icon: Icon.Calendar },
  { to: '/stats', label: 'Stats', icon: Icon.Chart },
];

export function Layout() {
  const { user } = useAuth();
  return (
    <div className="app">
      <nav className="sidenav">
        <NavLink to="/" className="brand"><span className="brand-logo"><Logo /></span><span className="brand-name">Sport</span></NavLink>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}><l.icon /> {l.label}</NavLink>
        ))}
        <div className="spacer" />
        <DiskGauge />
        <NavLink to="/settings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}><Icon.Settings /> Paramètres</NavLink>
        <NavLink to="/settings" className="nav-user"><Avatar user={user} /><span className="grow ellipsis">{user?.display_name}</span></NavLink>
      </nav>
      <main className="main"><Outlet /></main>
      <nav className="bottomnav">
        {links.filter((l) => !l.desktopOnly).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}><l.icon /> {l.label}</NavLink>
        ))}
      </nav>
    </div>
  );
}
