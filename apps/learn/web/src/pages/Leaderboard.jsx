import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';

export function Leaderboard() {
  const { user } = useAuth();
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/api/profile/leaderboard').then(setBoard).catch(setError); }, []);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!board) return <div className="page"><Spinner /></div>;
  const medals = ['🥇', '🥈', '🥉'];
  return (
    <div className="page" style={{ maxWidth: 720 }}>
      <div className="page-header"><div><h1>Classement du foyer</h1><p>XP gagnés sur les 7 derniers jours.</p></div></div>
      <div className="card card-pad">
        {board.map((b, i) => (
          <div key={b.user.id} className={'leader-row' + (b.user.id === user.id ? ' me' : '')}>
            <span className={'rank' + (i < 3 ? ' top' : '')}>{medals[i] || i + 1}</span>
            <Avatar user={b.user} />
            <div className="grow"><div style={{ fontWeight: 800 }}>{b.user.display_name}{b.user.id === user.id ? ' (toi)' : ''}</div><div className="muted small">{b.total_xp} XP au total · 🔥 {b.streak}</div></div>
            <span className="xp">{b.week_xp} XP</span>
          </div>
        ))}
        {board.length < 2 ? <p className="muted small mt-12">Invite les autres membres du foyer à créer un compte pour comparer vos progrès.</p> : null}
      </div>
    </div>
  );
}
