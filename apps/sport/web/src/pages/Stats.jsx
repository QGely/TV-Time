import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Icon } from '../components/Icons.jsx';
import { ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';
import { fmtDate, kg, minutesText, mmss, volumeText, distanceText, todayStr } from '../lib/format.js';
import { MUSCLE_LABELS } from '../components/BodyDiagram.jsx';

function WeightChart({ data, unit }) {
  if (data.length < 2) return <p className="muted small">Ajoutez au moins deux pesées pour voir la courbe.</p>;
  const w = 600, h = 160, pad = 28;
  const xs = data.map((d) => Date.parse(d.date));
  const ys = data.map((d) => d.weight_kg);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys) - 1, maxY = Math.max(...ys) + 1;
  const px = (x) => pad + ((x - minX) / Math.max(1, maxX - minX)) * (w - pad * 2);
  const py = (y) => h - pad - ((y - minY) / Math.max(1, maxY - minY)) * (h - pad * 2);
  const path = data.map((d, i) => `${i ? 'L' : 'M'}${px(Date.parse(d.date)).toFixed(1)},${py(d.weight_kg).toFixed(1)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="line-chart">
      <path d={path} className="line" />
      {data.map((d) => <circle key={d.date} cx={px(Date.parse(d.date))} cy={py(d.weight_kg)} r="3.5" className="dot"><title>{fmtDate(d.date, 'short')} · {kg(d.weight_kg, unit)}</title></circle>)}
      <text x={pad} y={py(maxY - 1) - 8} className="axis">{kg(maxY - 1, unit)}</text>
      <text x={pad} y={h - 6} className="axis">{fmtDate(data[0].date, 'short')}</text>
      <text x={w - pad} y={h - 6} textAnchor="end" className="axis">{fmtDate(data[data.length - 1].date, 'short')}</text>
    </svg>
  );
}

export function Stats() {
  const { user } = useAuth();
  const toast = useToast();
  const [stats, setStats] = useState(null);
  const [board, setBoard] = useState(null);
  const [error, setError] = useState(null);
  const [weight, setWeight] = useState('');
  const [date, setDate] = useState(todayStr());
  const load = () => api.get('/api/stats').then(setStats).catch(setError);
  useEffect(() => { load(); api.get('/api/stats/leaderboard').then(setBoard).catch(() => setBoard([])); }, []);
  const addWeight = async (e) => {
    e.preventDefault();
    try { await api.post('/api/body', { date, weight_kg: user.weight_unit === 'lb' ? Number(weight) / 2.20462 : Number(weight) }); setWeight(''); toast('Pesée enregistrée', 'success'); load(); } catch (err) { toast(err.message, 'error'); }
  };
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!stats) return <div className="page"><Spinner /></div>;
  const maxVol = Math.max(1, ...stats.weeks.map((w) => w.volume));
  const maxW = Math.max(1, ...stats.weeks.map((w) => w.workouts));
  const maxM = Math.max(1, ...stats.muscles.map((m) => m.sets));
  return (
    <div className="page">
      <div className="page-header"><div><h1>Statistiques</h1><p>Votre progression en un coup d'œil.</p></div></div>
      <div className="stats-strip mb-16" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }}>
        <div className="stat"><div className="value">{stats.workouts}</div><div className="label">Séances</div></div>
        <div className="stat"><div className="value">{minutesText(stats.minutes)}</div><div className="label">Temps</div></div>
        <div className="stat"><div className="value">{volumeText(stats.volume)}</div><div className="label">Volume</div></div>
        <div className="stat"><div className="value">🔥 {stats.streak.weeks}</div><div className="label">Sem. d'affilée</div></div>
      </div>
      <div className="detail-grid">
        <div>
          <section className="section">
            <SectionHead title="Séances par semaine" />
            <div className="card card-pad"><div className="bars">{stats.weeks.map((w) => <div key={w.week} className="bar" title={`Semaine du ${fmtDate(w.week, 'short')} · ${w.workouts} séances · ${minutesText(w.minutes)}`}><div className={'fill' + (w.workouts ? '' : ' dim')} style={{ height: `${Math.max(3, (w.workouts / maxW) * 100)}%` }} /><div className="lbl">{w.week.slice(8, 10)}/{w.week.slice(5, 7)}</div></div>)}</div></div>
          </section>
          <section className="section">
            <SectionHead title="Volume soulevé par semaine" />
            <div className="card card-pad"><div className="bars">{stats.weeks.map((w) => <div key={w.week} className="bar" title={`${volumeText(w.volume)} · ${w.sets} séries`}><div className={'fill' + (w.volume ? '' : ' dim')} style={{ height: `${Math.max(3, (w.volume / maxVol) * 100)}%` }} /><div className="lbl">{w.week.slice(8, 10)}/{w.week.slice(5, 7)}</div></div>)}</div></div>
          </section>
          <section className="section">
            <SectionHead title="Records personnels" />
            {stats.prs.length === 0 ? <p className="muted">Terminez une séance pour enregistrer vos premiers records.</p> : (
              <div className="card card-pad pr-table">
                {stats.prs.slice(0, 30).map((p) => (
                  <Link key={p.id} to={`/exercises/${p.id}`} className="pr-row">
                    <span className="grow ellipsis">{p.name}</span>
                    <span className="muted small">{p.count} séries</span>
                    <b>{p.unit === 'reps' ? (p.weight ? `${kg(p.weight, user.weight_unit)} · 1RM ~${kg(p.e1rm, user.weight_unit)}` : `${p.reps} reps`) : p.unit === 'time' ? mmss(p.seconds) : distanceText(p.distance_m)}</b>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
        <aside>
          <section className="section">
            <SectionHead title="Muscles (30 jours)" />
            <div className="card card-pad">{stats.muscles.length === 0 ? <p className="muted small">Aucune donnée.</p> : stats.muscles.slice(0, 10).map((m) => <div key={m.id} className="hbar"><span className="ellipsis">{MUSCLE_LABELS[m.id] || m.label}</span><div className="track"><div style={{ width: `${(m.sets / maxM) * 100}%` }} /></div><span className="val">{m.sets}</span></div>)}</div>
          </section>
          <section className="section">
            <SectionHead title="Poids corporel" />
            <div className="card card-pad">
              <WeightChart data={stats.body} unit={user.weight_unit} />
              <form className="row wrap mt-12" onSubmit={addWeight}>
                <input className="input" type="date" value={date} max={todayStr()} onChange={(e) => setDate(e.target.value)} style={{ width: 'auto' }} />
                <input className="input" type="number" step="0.1" min="20" placeholder={user.weight_unit} value={weight} onChange={(e) => setWeight(e.target.value)} style={{ width: 110 }} required />
                <button className="btn btn-primary btn-sm"><Icon.Plus /> Ajouter</button>
              </form>
            </div>
          </section>
          {board && board.length > 1 ? (
            <section className="section">
              <SectionHead title="Le foyer cette semaine" />
              <div className="list">{board.map((b, i) => <div key={b.user.id} className="list-item"><span className="list-num">{i + 1}</span><Avatar user={b.user} /><div className="grow"><div className="list-title">{b.user.display_name}</div><div className="muted small">{b.week.workouts} séances · {minutesText(b.week.minutes)}</div></div></div>)}</div>
            </section>
          ) : null}
          <section className="section">
            <SectionHead title="Badges" count={`${stats.badges.filter((b) => b.unlocked).length}/${stats.badges.length}`} />
            <div className="badges">{stats.badges.map((b) => <div key={b.id} className={'badge-card' + (b.unlocked ? '' : ' locked')}><div className="icon">{b.icon}</div><div className="name">{b.label}</div></div>)}</div>
          </section>
        </aside>
      </div>
    </div>
  );
}
