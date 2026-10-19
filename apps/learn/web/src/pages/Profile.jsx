import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icons.jsx';
import { ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';
import { fmtDate } from '../lib/format.js';

export function Profile() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/api/profile/stats').then(setStats).catch(setError); }, []);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!stats) return <div className="page"><Spinner /></div>;
  const maxDay = Math.max(1, ...stats.days.map((d) => d.xp));
  const prevLevelXp = 25 * (stats.level - 1) * (stats.level - 1);
  const levelPct = Math.round(((stats.total_xp - prevLevelXp) / Math.max(1, stats.next_level_xp - prevLevelXp)) * 100);
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <div className="row mb-16" style={{ gap: 18 }}>
        <Avatar user={user} size="lg" />
        <div className="grow"><h1>{user.display_name}</h1><p className="muted">@{user.username} · membre depuis {fmtDate(user.created_at)}</p><div className="row mt-8"><span className="chip chip-blue">Niveau {stats.level}</span><span className="muted small">{stats.total_xp} XP · {stats.next_level_xp - stats.total_xp} XP avant le niveau {stats.level + 1}</span></div><div className="progress mt-8" style={{ height: 10, maxWidth: 320 }}><div style={{ width: `${levelPct}%`, background: 'var(--blue)' }} /></div></div>
        <Link to="/settings" className="btn btn-icon" title="Paramètres"><Icon.Settings /></Link>
        <button className="btn btn-icon btn-ghost" onClick={logout} title="Se déconnecter"><Icon.Logout /></button>
      </div>
      <div className="stats-strip mb-16" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat"><div className="value">🔥 {stats.streak.current}</div><div className="label">Série (record {stats.streak.best})</div></div>
        <div className="stat"><div className="value">⚡ {stats.total_xp}</div><div className="label">XP total</div></div>
        <div className="stat"><div className="value">{stats.lessons}</div><div className="label">Leçons</div></div>
        <div className="stat"><div className="value">{stats.accuracy === null ? '—' : stats.accuracy + ' %'}</div><div className="label">Précision</div></div>
      </div>
      <section className="section">
        <SectionHead title="30 derniers jours" />
        <div className="card card-pad">
          <div className="bars">{stats.days.map((d) => <div key={d.date} className="bar" title={`${fmtDate(d.date)} · ${d.xp} XP`}><div className={'fill' + (d.xp ? '' : ' dim')} style={{ height: `${Math.max(3, (d.xp / maxDay) * 100)}%`, background: d.xp >= stats.daily_goal ? 'var(--yellow)' : undefined }} /><div className="lbl">{d.date.slice(8, 10)}</div></div>)}</div>
          <p className="muted small mt-8">En jaune : objectif du jour ({stats.daily_goal} XP) atteint.</p>
        </div>
      </section>
      {stats.courses.length ? (
        <section className="section">
          <SectionHead title="Mes cours" to="/courses" linkText="Tous les cours" />
          <div className="list">{stats.courses.map((c) => <div key={c.id} className="list-item"><span style={{ fontSize: 28 }}>{c.flag}</span><div className="grow"><div className="list-title">{c.title}</div><div className="muted small">{c.skills_started}/{c.skill_count} leçons commencées · {c.words_learned} mots · {c.xp} XP</div></div></div>)}</div>
        </section>
      ) : null}
      <section className="section">
        <SectionHead title="Succès" count={`${stats.badges.filter((b) => b.unlocked).length}/${stats.badges.length}`} />
        <div className="badges">{stats.badges.map((b) => <div key={b.id} className={'badge-card' + (b.unlocked ? '' : ' locked')}><div className="icon">{b.icon}</div><div className="name">{b.label}</div></div>)}</div>
      </section>
    </div>
  );
}
