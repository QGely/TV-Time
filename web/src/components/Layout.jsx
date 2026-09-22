import { NavLink, Outlet } from 'react-router-dom';
import { Icon, Logo } from './Icons.jsx';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from './Avatar.jsx';

const links = [
  { to: '/', label: 'Accueil', icon: Icon.Home, end: true },
  { to: '/explore', label: 'Explorer', icon: Icon.Compass },
  { to: '/collections', label: 'Collections', icon: Icon.Stack, desktopOnly: true },
  { to: '/calendar', label: 'Calendrier', icon: Icon.Calendar },
  { to: '/library', label: 'Ma liste', icon: Icon.Library },
  { to: '/profile', label: 'Profil', icon: Icon.User },
];

export function Layout() {
  const { user } = useAuth();
  return (
    <div className="app">
      <nav className="sidenav">
        <NavLink to="/" className="brand">
          <span className="brand-logo"><Logo /></span>
          <span className="brand-name">TV Time</span>
        </NavLink>
        {links.map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}>
            <l.icon /> {l.label}
          </NavLink>
        ))}
        <div className="spacer" />
        <NavLink to="/settings" className={({ isActive }) => 'nav-link' + (isActive ? ' active' : '')}><Icon.Settings /> Paramètres</NavLink>
        <NavLink to="/profile" className="nav-user">
          <Avatar user={user} />
          <span className="grow ellipsis">{user?.display_name}</span>
        </NavLink>
      </nav>
      <main className="main">
        <Outlet />
      </main>
      <nav className="bottomnav">
        {links.filter((l) => !l.desktopOnly).map((l) => (
          <NavLink key={l.to} to={l.to} end={l.end} className={({ isActive }) => (isActive ? 'active' : '')}>
            <l.icon /> {l.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
