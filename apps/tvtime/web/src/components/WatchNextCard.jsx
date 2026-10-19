import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Poster } from './Poster.jsx';
import { Icon } from './Icons.jsx';
import { epCode, relativeDay } from '../lib/format.js';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';

/** "Watch next" card: show, next episode and a big check to mark it watched. */
export function WatchNextCard({ show, onChange }) {
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const toast = useToast();
  const ep = show.next_episode;

  const mark = async (e) => {
    e.preventDefault();
    if (!ep || busy) return;
    setBusy(true);
    try {
      setDone(true);
      const updated = await api.post(`/api/shows/${show.id}/episodes/${ep.id}/watch`);
      toast(`${epCode(ep)} de ${show.name} marqué comme vu`, 'success');
      setTimeout(() => { setDone(false); onChange?.(updated); }, 350);
    } catch (err) {
      setDone(false);
      toast(err.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Link to={`/show/${show.id}`} className="wn-card">
      <Poster path={show.poster_path} title={show.name} size="w185" />
      <div className="body">
        <div className="show ellipsis">{show.name}</div>
        {ep ? (
          <div className="ep clamp-2"><b>{epCode(ep)}</b>{ep.name}</div>
        ) : (
          <div className="ep muted">Aucun épisode à voir</div>
        )}
        <div className="meta">
          {show.remaining_count > 0 ? <span>{show.remaining_count} épisode{show.remaining_count > 1 ? 's' : ''} restant{show.remaining_count > 1 ? 's' : ''}</span> : null}
          {ep?.air_date ? <span>· {relativeDay(ep.air_date)}</span> : null}
        </div>
        <div className="progress mt-8"><div style={{ width: `${show.percent}%` }} /></div>
      </div>
      {ep ? (
        <div className="actions">
          <button className={'check-btn' + (done ? ' done' : '')} onClick={mark} disabled={busy} title="Marquer comme vu" aria-label="Marquer comme vu">
            <Icon.Check />
          </button>
        </div>
      ) : null}
    </Link>
  );
}
