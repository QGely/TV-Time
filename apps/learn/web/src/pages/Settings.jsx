import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStatus } from '../lib/status.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Spinner } from '../components/Misc.jsx';
import { DiskGauge, useSystemInfo } from '../components/DiskGauge.jsx';
import { AVATARS, bytes, uptime } from '../lib/format.js';

export function Settings() {
  const { user, setUser, logout } = useAuth();
  const { refresh } = useStatus();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState(null);
  const [displayName, setDisplayName] = useState(user.display_name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [goal, setGoal] = useState(user.daily_goal);
  const [sound, setSound] = useState(user.sound);
  const [pw, setPw] = useState({ current: '', next: '' });
  const system = useSystemInfo();
  const load = () => api.get('/api/settings').then((s) => { setSettings(s); if (s.is_admin) api.get('/api/settings/users').then(setUsers).catch(() => {}); });
  useEffect(() => { load(); }, []);
  const saveProfile = async (e) => {
    e.preventDefault();
    try { const r = await api.put('/api/auth/me', { display_name: displayName, avatar: avatar || null, daily_goal: goal, sound }); setUser(r.user); refresh(); toast('Profil enregistré', 'success'); } catch (err) { toast(err.message, 'error'); }
  };
  const savePassword = async (e) => {
    e.preventDefault();
    try { await api.put('/api/auth/me', { current_password: pw.current, password: pw.next }); setPw({ current: '', next: '' }); toast('Mot de passe modifié', 'success'); } catch (err) { toast(err.message, 'error'); }
  };
  const toggleRegistration = async () => { try { await api.put('/api/settings', { allow_registration: !settings.allow_registration }); await load(); } catch (err) { toast(err.message, 'error'); } };
  const deleteUser = async (u) => { if (!window.confirm(`Supprimer le compte de ${u.display_name} et toute sa progression ?`)) return; try { await api.del(`/api/settings/users/${u.id}`); setUsers((l) => l.filter((x) => x.id !== u.id)); } catch (err) { toast(err.message, 'error'); } };
  if (!settings) return <div className="page"><Spinner /></div>;
  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-header"><div><h1>Paramètres</h1><p>Ton profil, ton objectif quotidien et le serveur.</p></div></div>
      <section className="settings-section card card-pad">
        <h2>Mon profil</h2>
        <form onSubmit={saveProfile}>
          <div className="row"><Avatar user={{ ...user, display_name: displayName, avatar }} size="lg" /><div className="grow field"><label>Nom affiché</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} /></div></div>
          <div className="field"><label>Avatar</label><div className="avatar-picker"><button type="button" className={!avatar ? 'active' : ''} onClick={() => setAvatar('')}>Aa</button>{AVATARS.map((a) => <button type="button" key={a} className={avatar === a ? 'active' : ''} onClick={() => setAvatar(a)}>{a}</button>)}</div></div>
          <div className="field"><label>Objectif quotidien</label><div className="goal-picker">{[[10, 'Tranquille'], [20, 'Régulier'], [30, 'Sérieux'], [50, 'Intense']].map(([v, l]) => <button type="button" key={v} className={goal === v ? 'active' : ''} onClick={() => setGoal(v)}>{v} XP<br /><span className="muted small">{l}</span></button>)}</div></div>
          <div className="toggle"><div><b>Lecture à voix haute</b><div className="muted small">Prononce les mots et phrases pendant les leçons (si le navigateur le permet).</div></div><button type="button" className={'switch' + (sound ? ' on' : '')} onClick={() => setSound(!sound)} aria-label="Son" /></div>
          <div><button className="btn btn-primary">Enregistrer</button></div>
        </form>
      </section>
      <section className="settings-section card card-pad">
        <h2>Mot de passe</h2>
        <form onSubmit={savePassword}>
          <div className="field"><label>Mot de passe actuel</label><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></div>
          <div className="field"><label>Nouveau mot de passe</label><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength={6} required /></div>
          <div><button className="btn">Modifier</button></div>
        </form>
      </section>
      {settings.is_admin ? (
        <section className="settings-section card card-pad">
          <h2>Utilisateurs</h2>
          <div className="toggle"><div><b>Autoriser les inscriptions</b><div className="muted small">Permet aux autres membres du foyer de créer un compte.</div></div><button type="button" className={'switch' + (settings.allow_registration ? ' on' : '')} onClick={toggleRegistration} aria-label="Autoriser les inscriptions" /></div>
          {users ? users.map((u) => <div key={u.id} className="user-row"><Avatar user={u} /><div className="grow"><div style={{ fontWeight: 800 }}>{u.display_name} {u.is_admin ? <span className="chip chip-blue">admin</span> : null}</div><div className="muted small">@{u.username}</div></div>{u.id !== user.id ? <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}><Icon.Trash /></button> : null}</div>) : null}
        </section>
      ) : null}
      <section className="settings-section card card-pad">
        <h2>Serveur et stockage</h2>
        {!system ? <Spinner /> : (<><DiskGauge compact={false} /><dl className="info-list mt-16"><dt>Base de données</dt><dd>{bytes(system.db_bytes)} · {system.data_dir}</dd><dt>Leçons terminées</dt><dd>{system.counts.lessons} · {system.counts.xp} XP cumulés</dd><dt>Utilisateurs</dt><dd>{system.counts.users}</dd><dt>En ligne depuis</dt><dd>{uptime(system.uptime_seconds)}</dd><dt>Version</dt><dd>Apprendre {system.version} · Node {system.node}</dd></dl></>)}
      </section>
      <section className="settings-section"><button className="btn btn-ghost" onClick={logout}><Icon.Logout /> Se déconnecter</button></section>
    </div>
  );
}
