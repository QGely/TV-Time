import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { fmtDate, mmss, volumeText, todayStr } from '../lib/format.js';
import { MUSCLE_LABELS } from '../components/BodyDiagram.jsx';

export function History() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/api/workouts?limit=500').then(setList).catch(setError); }, []);
  const months = useMemo(() => {
    const m = new Map();
    for (const w of list || []) { const k = w.started_at.slice(0, 7); if (!m.has(k)) m.set(k, []); m.get(k).push(w); }
    return [...m.entries()];
  }, [list]);
  const days = useMemo(() => new Set((list || []).map((w) => w.started_at.slice(0, 10))), [list]);
  const strip = useMemo(() => { const out = []; const t = todayStr(); for (let i = 83; i >= 0; i--) { const d = new Date(Date.parse(t) - i * 864e5).toISOString().slice(0, 10); out.push(d); } return out; }, []);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  return (
    <div className="page">
      <div className="page-header"><div><h1>Historique</h1><p>{list ? `${list.length} séance${list.length > 1 ? 's' : ''} terminée${list.length > 1 ? 's' : ''}` : ''}</p></div></div>
      <div className="heat mb-16" title="12 dernières semaines">{strip.map((d) => <span key={d} className={'heat-cell' + (days.has(d) ? ' on' : '')} title={fmtDate(d, 'short')} />)}</div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon="📅" title="Aucune séance" text="Votre première séance apparaîtra ici." action="Démarrer" to="/" /> : months.map(([k, ws]) => (
        <section key={k} className="section">
          <div className="section-head"><h2 style={{ textTransform: 'capitalize' }}>{fmtDate(k + '-01', 'month')}</h2><span className="count">{ws.length} séance{ws.length > 1 ? 's' : ''} · {mmss(ws.reduce((s, w) => s + (w.duration_seconds || 0), 0))}</span></div>
          <div className="list">
            {ws.map((w) => (
              <Link key={w.id} to={`/workouts/${w.id}`} className="list-item">
                <div className="list-icon">{w.mood || '🏋️'}</div>
                <div className="grow">
                  <div className="list-title">{w.name}</div>
                  <div className="muted small">{fmtDate(w.started_at, 'time')} · {mmss(w.duration_seconds)} · {w.exercise_count} exercices · {w.sets} séries{w.volume ? ` · ${volumeText(w.volume)}` : ''}</div>
                  <div className="row wrap mt-8">{w.muscles.slice(0, 5).map((m) => <span key={m} className="chip">{MUSCLE_LABELS[m]}</span>)}</div>
                </div>
                <Icon.ChevronRight className="muted" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
