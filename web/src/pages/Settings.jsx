import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icons.jsx';
import { Spinner } from '../components/Misc.jsx';
import { AVATARS } from '../lib/format.js';

export function Settings() {
  const { user, setUser, refresh, logout } = useAuth();
  const toast = useToast();
  const [settings, setSettings] = useState(null);
  const [users, setUsers] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [language, setLanguage] = useState('fr-FR');
  const [displayName, setDisplayName] = useState(user.display_name);
  const [avatar, setAvatar] = useState(user.avatar || '');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [busy, setBusy] = useState(false);

  const load = () => api.get('/api/settings').then((s) => { setSettings(s); setLanguage(s.language); if (s.is_admin) api.get('/api/settings/users').then(setUsers).catch(() => {}); });
  useEffect(() => { load(); }, []);

  const saveProfile = async (e) => {
    e.preventDefault();
    try {
      const r = await api.put('/api/auth/me', { display_name: displayName, avatar: avatar || null });
      setUser(r.user);
      toast('Profil enregistré', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  const savePassword = async (e) => {
    e.preventDefault();
    try {
      await api.put('/api/auth/me', { current_password: pw.current, password: pw.next });
      setPw({ current: '', next: '' });
      toast('Mot de passe modifié', 'success');
    } catch (err) { toast(err.message, 'error'); }
  };

  const saveTmdb = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await api.put('/api/settings', { ...(apiKey ? { tmdb_api_key: apiKey } : {}), language });
      const t = await api.post('/api/settings/test-tmdb').catch((err) => ({ ok: false, error: err.message }));
      if (t.ok) toast('Connexion à TMDB réussie', 'success'); else toast(`TMDB : ${t.error}`, 'error');
      setApiKey('');
      await load();
      await refresh();
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const toggleRegistration = async () => {
    try {
      await api.put('/api/settings', { allow_registration: !settings.allow_registration });
      await load();
    } catch (err) { toast(err.message, 'error'); }
  };

  const refreshAll = async () => {
    setBusy(true);
    try { const r = await api.post('/api/settings/refresh'); toast(`${r.ok} série(s) mise(s) à jour sur ${r.due} à rafraîchir`, 'success'); } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };

  const deleteUser = async (u) => {
    if (!window.confirm(`Supprimer le compte de ${u.display_name} et tout son historique ?`)) return;
    try { await api.del(`/api/settings/users/${u.id}`); setUsers((l) => l.filter((x) => x.id !== u.id)); toast('Compte supprimé', 'success'); } catch (err) { toast(err.message, 'error'); }
  };

  if (!settings) return <div className="page"><Spinner /></div>;

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <div className="page-header"><div><h1>Paramètres</h1><p>Votre profil et la configuration du serveur.</p></div></div>

      <section className="settings-section card card-pad">
        <h2>Mon profil</h2>
        <form onSubmit={saveProfile}>
          <div className="row"><Avatar user={{ ...user, display_name: displayName, avatar }} size="lg" /><div className="grow"><div className="field"><label>Nom affiché</label><input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={40} /></div></div></div>
          <div className="field">
            <label>Avatar</label>
            <div className="avatar-picker">
              <button type="button" className={!avatar ? 'active' : ''} onClick={() => setAvatar('')} title="Initiales">Aa</button>
              {AVATARS.map((a) => <button type="button" key={a} className={avatar === a ? 'active' : ''} onClick={() => setAvatar(a)}>{a}</button>)}
            </div>
          </div>
          <div><button className="btn btn-primary">Enregistrer</button></div>
        </form>
      </section>

      <section className="settings-section card card-pad">
        <h2>Mot de passe</h2>
        <form onSubmit={savePassword}>
          <div className="field"><label>Mot de passe actuel</label><input className="input" type="password" autoComplete="current-password" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} required /></div>
          <div className="field"><label>Nouveau mot de passe</label><input className="input" type="password" autoComplete="new-password" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} minLength={6} required /></div>
          <div><button className="btn">Modifier le mot de passe</button></div>
        </form>
      </section>

      {settings.is_admin ? (
        <>
          <section className="settings-section card card-pad">
            <h2>TMDB (métadonnées)</h2>
            <p className="muted small mb-16">
              Les données des séries proviennent de <a href="https://www.themoviedb.org/" target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>The Movie Database</a>.
              Créez un compte gratuit puis générez une clé API dans <span className="code">Paramètres → API</span>. La clé v3 et le jeton de lecture v4 sont acceptés.
            </p>
            <form onSubmit={saveTmdb}>
              <div className="field">
                <label>Clé API {settings.has_api_key ? <span className="chip chip-green">configurée · {settings.api_key_masked}</span> : <span className="chip chip-red">manquante</span>}</label>
                {settings.api_key_from_env ? <span className="hint">Définie par la variable d'environnement TMDB_API_KEY (non modifiable ici).</span> : (
                  <input className="input" value={apiKey} onChange={(e) => setApiKey(e.target.value)} placeholder={settings.has_api_key ? 'Laisser vide pour conserver la clé actuelle' : 'Collez votre clé API TMDB'} autoComplete="off" spellCheck={false} />
                )}
              </div>
              <div className="field">
                <label>Langue des métadonnées</label>
                <select className="input" value={language} onChange={(e) => setLanguage(e.target.value)}>
                  <option value="fr-FR">Français</option>
                  <option value="fr-CA">Français (Canada)</option>
                  <option value="en-US">English</option>
                  <option value="es-ES">Español</option>
                  <option value="de-DE">Deutsch</option>
                  <option value="it-IT">Italiano</option>
                  <option value="pt-BR">Português (Brasil)</option>
                </select>
                <span className="hint">Les séries déjà ajoutées seront traduites lors de leur prochaine actualisation.</span>
              </div>
              <div className="row wrap">
                <button className="btn btn-primary" disabled={busy}>Enregistrer et tester</button>
                <button type="button" className="btn" disabled={busy} onClick={refreshAll}><Icon.Refresh /> Actualiser toutes les séries</button>
              </div>
            </form>
          </section>

          <section className="settings-section card card-pad">
            <h2>Utilisateurs</h2>
            <div className="toggle">
              <div><div><b>Autoriser les inscriptions</b></div><div className="muted small">Permet à d'autres membres du foyer de créer un compte depuis la page de connexion.</div></div>
              <button type="button" className={'switch' + (settings.allow_registration ? ' on' : '')} onClick={toggleRegistration} aria-label="Autoriser les inscriptions" />
            </div>
            {users ? users.map((u) => (
              <div key={u.id} className="user-row">
                <Avatar user={u} />
                <div className="grow"><div>{u.display_name} {u.is_admin ? <span className="chip chip-accent">admin</span> : null}</div><div className="muted small">@{u.username}</div></div>
                {u.id !== user.id ? <button className="btn btn-sm btn-danger" onClick={() => deleteUser(u)}><Icon.Trash /></button> : null}
              </div>
            )) : null}
          </section>
        </>
      ) : null}

      <section className="settings-section">
        <button className="btn btn-ghost" onClick={logout}><Icon.Logout /> Se déconnecter</button>
      </section>
    </div>
  );
}
