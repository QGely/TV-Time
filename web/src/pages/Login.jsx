import { useState } from 'react';
import { useAuth } from '../lib/auth.jsx';
import { Logo } from '../components/Icons.jsx';

export function Login() {
  const { login, register, needs_setup, allow_registration } = useAuth();
  const [mode, setMode] = useState(needs_setup ? 'register' : 'login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'register') await register(username.trim(), password, displayName.trim() || username.trim());
      else await login(username.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-card">
        <div className="brand"><span className="brand-logo"><Logo /></span><span className="brand-name">TV Time</span></div>
        <h1>{needs_setup ? 'Bienvenue !' : mode === 'register' ? 'Créer un compte' : 'Connexion'}</h1>
        <p className="sub">
          {needs_setup ? 'Créez le premier compte : il sera administrateur.' : mode === 'register' ? 'Rejoignez le foyer et suivez vos séries.' : 'Reprenez vos séries là où vous les avez laissées.'}
        </p>
        <form onSubmit={submit}>
          <div className="field">
            <label>Nom d'utilisateur</label>
            <input className="input" autoFocus autoComplete="username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          {mode === 'register' ? (
            <div className="field">
              <label>Nom affiché</label>
              <input className="input" value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder={username || 'Votre prénom'} />
            </div>
          ) : null}
          <div className="field">
            <label>Mot de passe</label>
            <input className="input" type="password" autoComplete={mode === 'register' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error ? <div className="error-box">{error}</div> : null}
          <button className="btn btn-primary btn-block" disabled={busy}>{mode === 'register' ? 'Créer mon compte' : 'Se connecter'}</button>
        </form>
        {!needs_setup ? (
          <div className="auth-switch">
            {mode === 'login' ? (
              allow_registration ? <>Pas encore de compte ? <button className="link-btn" onClick={() => setMode('register')}>Inscription</button></> : null
            ) : (
              <>Déjà inscrit ? <button className="link-btn" onClick={() => setMode('login')}>Connexion</button></>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
