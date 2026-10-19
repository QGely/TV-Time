import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';
import { fmtDate, kg, minutesText, mmss, timeAgo, volumeText } from '../lib/format.js';
import { MUSCLE_LABELS } from '../components/BodyDiagram.jsx';

function GoalRing({ value, goal }) {
  const pct = Math.min(1, goal ? value / goal : 0);
  const r = 44, c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 110 110" className="goal-ring">
      <circle cx="55" cy="55" r={r} className="track" />
      <circle cx="55" cy="55" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - pct)} />
      <text x="55" y="52" textAnchor="middle" className="big">{value}/{goal}</text>
      <text x="55" y="70" textAnchor="middle" className="small">séances</text>
    </svg>
  );
}

export function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [active, setActive] = useState(undefined);
  const [routines, setRoutines] = useState(null);
  const [recent, setRecent] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.get('/api/stats').then(setStats).catch(setError);
    api.get('/api/workouts/active').then(setActive).catch(() => setActive(null));
    api.get('/api/routines').then(setRoutines).catch(() => setRoutines([]));
    api.get('/api/workouts?limit=5').then(setRecent).catch(() => setRecent([]));
  }, []);

  const start = async (body) => {
    if (busy) return;
    setBusy(true);
    try {
      const w = await api.post('/api/workouts', body);
      navigate(`/workout/${w.id}`);
    } catch (e) {
      if (e.status === 409) navigate('/workout/active'); else toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!stats || active === undefined || !routines || !recent) return <div className="page"><Spinner /></div>;

  const lastWeight = stats.body[stats.body.length - 1];
  const topMuscles = stats.muscles.slice(0, 4);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>{greeting}, {user.display_name} 💪</h1><p>{stats.this_week.workouts >= stats.this_week.goal ? 'Objectif de la semaine atteint, bravo !' : `${stats.this_week.goal - stats.this_week.workouts} séance${stats.this_week.goal - stats.this_week.workouts > 1 ? 's' : ''} pour atteindre l'objectif de la semaine`}</p></div>
        {active ? <Link to={`/workout/${active.id}`} className="btn btn-primary"><Icon.Play /> Reprendre la séance</Link> : <button className="btn btn-primary" onClick={() => start({})} disabled={busy}><Icon.Plus /> Séance libre</button>}
      </div>

      {active ? (
        <Link to={`/workout/${active.id}`} className="active-banner">
          <span className="pulse" />
          <div className="grow"><b>Séance en cours : {active.name}</b><div className="small muted">Commencée {timeAgo(active.started_at)} · {active.stats.sets_done}/{active.stats.sets_total} séries</div></div>
          <Icon.ChevronRight />
        </Link>
      ) : null}

      <div className="dash-grid">
        <div className="card card-pad dash-goal">
          <GoalRing value={stats.this_week.workouts} goal={stats.this_week.goal} />
          <div>
            <div className="stat-label">Cette semaine</div>
            <div className="dash-kpis">
              <div><b>{minutesText(stats.this_week.minutes)}</b><span>d'entraînement</span></div>
              <div><b>🔥 {stats.streak.weeks}</b><span>semaine{stats.streak.weeks > 1 ? 's' : ''} d'affilée</span></div>
            </div>
          </div>
        </div>
        <div className="stats-strip">
          <div className="stat"><div className="value">{stats.workouts}</div><div className="label">Séances</div></div>
          <div className="stat"><div className="value">{minutesText(stats.minutes)}</div><div className="label">Temps total</div></div>
          <div className="stat"><div className="value">{volumeText(stats.volume)}</div><div className="label">Soulevés</div></div>
        </div>
      </div>

      <section className="section">
        <SectionHead title="Démarrer une routine" to="/routines" linkText="Toutes les routines" />
        {routines.length === 0 ? (
          <Empty icon="📋" title="Aucune routine" text="Adoptez un programme ou créez votre propre routine." action="Voir les programmes" to="/programs" />
        ) : (
          <div className="hscroll">
            {routines.slice(0, 8).map((rt) => (
              <div key={rt.id} className="routine-card">
                <div className="routine-icon">{rt.icon || '🏋️'}</div>
                <div className="routine-name clamp-2">{rt.name}</div>
                <div className="muted small">{rt.exercises.length} exercices · ~{rt.estimated_minutes} min</div>
                <div className="muted small">{rt.last_done_at ? `Dernière fois ${timeAgo(rt.last_done_at)}` : 'Jamais faite'}</div>
                <button className="btn btn-primary btn-sm btn-block mt-8" disabled={busy || !!active} onClick={() => start({ routine_id: rt.id })}><Icon.Play /> Démarrer</button>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="detail-grid">
        <section className="section">
          <SectionHead title="Dernières séances" to="/history" linkText="Historique" />
          {recent.length === 0 ? <p className="muted">Aucune séance terminée pour le moment.</p> : (
            <div className="list">
              {recent.map((w) => (
                <Link key={w.id} to={`/workouts/${w.id}`} className="list-item">
                  <div className="list-icon">🏋️</div>
                  <div className="grow"><div className="list-title">{w.name}</div><div className="muted small">{fmtDate(w.started_at, 'time')} · {mmss(w.duration_seconds)} · {w.sets} séries{w.volume ? ` · ${volumeText(w.volume)}` : ''}</div></div>
                  <Icon.ChevronRight className="muted" />
                </Link>
              ))}
            </div>
          )}
        </section>
        <aside>
          <section className="section">
            <SectionHead title="Muscles travaillés (30 j)" />
            {topMuscles.length === 0 ? <p className="muted small">Terminez une séance pour voir la répartition.</p> : topMuscles.map((m) => (
              <div key={m.id} className="hbar"><span className="ellipsis">{MUSCLE_LABELS[m.id] || m.label}</span><div className="track"><div style={{ width: `${(m.sets / topMuscles[0].sets) * 100}%` }} /></div><span className="val">{m.sets} séries</span></div>
            ))}
          </section>
          <section className="section">
            <SectionHead title="Poids corporel" to="/stats" linkText="Suivi" />
            <div className="card card-pad row">
              <Icon.Scale />
              <div className="grow">{lastWeight ? <><b>{kg(lastWeight.weight_kg, user.weight_unit)}</b><div className="muted small">le {fmtDate(lastWeight.date, 'short')}</div></> : <span className="muted">Aucune pesée enregistrée</span>}</div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}
