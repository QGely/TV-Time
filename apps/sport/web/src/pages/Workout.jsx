import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { ExercisePicker } from '../components/ExercisePicker.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';
import { fmtDate, mmss, volumeText, MOODS, CATEGORY_ICONS } from '../lib/format.js';

function useElapsed(startedAt, finished) {
  const [now, setNow] = useState(Date.now());
  useEffect(() => { if (finished) return; const t = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(t); }, [finished]);
  if (!startedAt) return 0;
  return Math.max(0, Math.round((now - Date.parse(startedAt.replace(' ', 'T') + 'Z')) / 1000));
}

function RestTimer({ seconds, onDone }) {
  const [left, setLeft] = useState(seconds);
  const [total, setTotal] = useState(seconds);
  useEffect(() => { setLeft(seconds); setTotal(seconds); }, [seconds]);
  useEffect(() => {
    if (left <= 0) { try { navigator.vibrate?.([200, 100, 200]); } catch {} onDone(); return; }
    const t = setTimeout(() => setLeft((l) => l - 1), 1000);
    return () => clearTimeout(t);
  }, [left, onDone]);
  const r = 54, c = 2 * Math.PI * r;
  return (
    <div className="rest-timer">
      <svg viewBox="0 0 120 120"><circle cx="60" cy="60" r={r} className="track" /><circle cx="60" cy="60" r={r} className="fill" strokeDasharray={c} strokeDashoffset={c * (1 - left / Math.max(1, total))} /><text x="60" y="68" textAnchor="middle">{mmss(left)}</text></svg>
      <div className="rest-actions">
        <button className="btn btn-sm" onClick={() => { setLeft((l) => l + 30); setTotal((t) => t + 30); }}>+30 s</button>
        <button className="btn btn-sm btn-ghost" onClick={onDone}>Passer</button>
      </div>
      <div className="muted small">Repos</div>
    </div>
  );
}

export function Workout() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [w, setW] = useState(null);
  const [error, setError] = useState(null);
  const [picker, setPicker] = useState(false);
  const [rest, setRest] = useState(null);
  const [finishing, setFinishing] = useState(false);
  const [summary, setSummary] = useState(null);
  const [cancelAsk, setCancelAsk] = useState(false);
  const [notes, setNotes] = useState('');
  const [mood, setMood] = useState(null);
  const pending = useRef(new Map());

  const load = useCallback(async () => {
    try {
      setError(null);
      const data = id === 'active' ? await api.get('/api/workouts/active') : await api.get(`/api/workouts/${id}`);
      if (!data) { navigate('/'); return; }
      if (id === 'active') { navigate(`/workout/${data.id}`, { replace: true }); return; }
      setW(data);
      setNotes(data.notes || '');
      setMood(data.mood || null);
    } catch (e) { setError(e); }
  }, [id, navigate]);
  useEffect(() => { load(); }, [load]);

  const finished = !!w?.finished_at;
  const elapsed = useElapsed(w?.started_at, finished);

  const patchSet = (setId, patch, immediate = false) => {
    setW((cur) => ({ ...cur, exercises: cur.exercises.map((e) => ({ ...e, sets: e.sets.map((s) => (s.id === setId ? { ...s, ...patch } : s)) })) }));
    const prev = pending.current.get(setId) || { timer: null, patch: {} };
    const merged = { ...prev.patch, ...patch };
    clearTimeout(prev.timer);
    const flush = async () => {
      pending.current.delete(setId);
      try { const data = await api.put(`/api/workouts/${w.id}/sets/${setId}`, merged); setW(data); } catch (e) { toast(e.message, 'error'); }
    };
    if (immediate) flush(); else pending.current.set(setId, { timer: setTimeout(flush, 600), patch: merged });
  };

  const toggleDone = (we, s) => {
    const done = !s.done;
    patchSet(s.id, { done, reps: s.reps, weight: s.weight, seconds: s.seconds, distance_m: s.distance_m }, true);
    if (done && !finished && we.rest_seconds > 0) setRest({ key: Date.now(), seconds: we.rest_seconds });
  };

  const addSet = async (we) => { try { setW(await api.post(`/api/workouts/${w.id}/exercises/${we.id}/sets`)); } catch (e) { toast(e.message, 'error'); } };
  const removeSet = async (s) => { try { setW(await api.del(`/api/workouts/${w.id}/sets/${s.id}`)); } catch (e) { toast(e.message, 'error'); } };
  const removeExercise = async (we) => { try { setW(await api.del(`/api/workouts/${w.id}/exercises/${we.id}`)); } catch (e) { toast(e.message, 'error'); } };
  const addExercises = async (list) => { try { let data = w; for (const e of list) data = await api.post(`/api/workouts/${w.id}/exercises`, { exercise_id: e.id }); setW(data); } catch (e) { toast(e.message, 'error'); } };

  const finish = async () => {
    try {
      await api.put(`/api/workouts/${w.id}`, { notes, mood });
      const data = await api.post(`/api/workouts/${w.id}/finish`, { duration_seconds: elapsed });
      setFinishing(false);
      setW(data);
      setSummary(data);
    } catch (e) { toast(e.message, 'error'); }
  };
  const cancel = async () => { try { await api.del(`/api/workouts/${w.id}`); navigate('/'); } catch (e) { toast(e.message, 'error'); } };
  const repeat = async () => { try { const n = await api.post('/api/workouts', { repeat_workout_id: w.id }); navigate(`/workout/${n.id}`); } catch (e) { if (e.status === 409) navigate('/workout/active'); else toast(e.message, 'error'); } };
  const saveNotes = async () => { try { setW(await api.put(`/api/workouts/${w.id}`, { notes, mood })); toast('Enregistré', 'success'); } catch (e) { toast(e.message, 'error'); } };

  if (error) return <div className="page"><ErrorBox error={error} onRetry={load} /></div>;
  if (!w) return <div className="page"><Spinner /></div>;

  const unitLabel = (u) => (u === 'time' ? 'Durée (s)' : u === 'distance' ? 'Distance (m)' : 'Reps');
  const done = w.stats.sets_done, total = w.stats.sets_total;

  return (
    <div className="page workout-page">
      <div className="workout-head">
        <button className="btn btn-ghost btn-sm" onClick={() => navigate(finished ? '/history' : '/')}><Icon.Back /> {finished ? 'Historique' : 'Accueil'}</button>
        <div className="grow">
          <input className="workout-title" value={w.name} onChange={(e) => setW({ ...w, name: e.target.value })} onBlur={() => api.put(`/api/workouts/${w.id}`, { name: w.name }).catch(() => {})} disabled={finished} />
          <div className="muted small">{finished ? `${fmtDate(w.started_at, 'time')} · ${mmss(w.duration_seconds)}` : `Commencée à ${w.started_at.slice(11, 16)} UTC`}</div>
        </div>
        {!finished ? <div className="workout-timer"><Icon.Clock /> {mmss(elapsed)}</div> : null}
      </div>

      <div className="stats-strip mb-16">
        <div className="stat"><div className="value">{done}/{total}</div><div className="label">Séries</div></div>
        <div className="stat"><div className="value">{w.stats.reps}</div><div className="label">Répétitions</div></div>
        <div className="stat"><div className="value">{volumeText(w.stats.volume)}</div><div className="label">Volume</div></div>
      </div>
      {!finished ? <div className="progress mb-16"><div style={{ width: `${total ? (done / total) * 100 : 0}%` }} /></div> : null}

      {w.exercises.length === 0 ? <div className="empty"><div className="icon">🏋️</div><h3>Séance vide</h3><p>Ajoutez un exercice pour commencer.</p></div> : null}

      {w.exercises.map((we) => (
        <section key={we.id} className="we-card">
          <div className="we-head">
            <span className="we-icon">{CATEGORY_ICONS[we.exercise.category]}</span>
            <div className="grow">
              <Link to={`/exercises/${we.exercise.id}`} className="we-name">{we.exercise.name}</Link>
              <div className="muted small">{we.target_reps ? `Objectif ${we.target_sets} × ${we.target_reps} · ` : ''}repos {we.rest_seconds} s{we.previous?.length ? ` · précédent : ${we.previous.map((p) => (we.exercise.unit === 'reps' ? `${p.reps || 0}${p.weight ? '×' + p.weight : ''}` : we.exercise.unit === 'time' ? `${p.seconds || 0}s` : `${p.distance_m || 0}m`)).join(' ')}` : ''}</div>
            </div>
            {!finished ? <button className="btn btn-icon btn-ghost btn-sm" onClick={() => removeExercise(we)} title="Retirer"><Icon.Trash /></button> : null}
          </div>
          <div className="set-table">
            <div className="set-row set-header"><span>Série</span><span>Préc.</span>{we.exercise.unit === 'reps' ? <><span>{user.weight_unit}</span><span>Reps</span></> : <><span>{unitLabel(we.exercise.unit)}</span><span /></>}<span /></div>
            {we.sets.map((s, i) => {
              const prev = we.previous?.[i];
              return (
                <div key={s.id} className={'set-row' + (s.done ? ' done' : '')}>
                  <span className="set-num">{s.set_number}</span>
                  <span className="muted small">{prev ? (we.exercise.unit === 'reps' ? `${prev.reps || 0}${prev.weight ? ' × ' + prev.weight : ''}` : we.exercise.unit === 'time' ? mmss(prev.seconds) : `${prev.distance_m || 0} m`) : '—'}</span>
                  {we.exercise.unit === 'reps' ? (<>
                    <input className="set-input" type="number" inputMode="decimal" step="0.5" min="0" placeholder="—" value={s.weight ?? ''} onChange={(e) => patchSet(s.id, { weight: e.target.value === '' ? null : Number(e.target.value) })} disabled={finished} />
                    <input className="set-input" type="number" inputMode="numeric" min="0" placeholder="—" value={s.reps ?? ''} onChange={(e) => patchSet(s.id, { reps: e.target.value === '' ? null : Number(e.target.value) })} disabled={finished} />
                  </>) : we.exercise.unit === 'time' ? (<>
                    <input className="set-input" type="number" inputMode="numeric" min="0" placeholder="s" value={s.seconds ?? ''} onChange={(e) => patchSet(s.id, { seconds: e.target.value === '' ? null : Number(e.target.value) })} disabled={finished} /><span />
                  </>) : (<>
                    <input className="set-input" type="number" inputMode="decimal" min="0" placeholder="m" value={s.distance_m ?? ''} onChange={(e) => patchSet(s.id, { distance_m: e.target.value === '' ? null : Number(e.target.value) })} disabled={finished} /><span />
                  </>)}
                  <span className="row">
                    {!finished ? <button className={'check-btn sm' + (s.done ? ' done' : '')} onClick={() => toggleDone(we, s)} aria-label="Série terminée"><Icon.Check /></button> : <span className="check-btn sm done"><Icon.Check /></span>}
                    {!finished && !s.done ? <button className="btn btn-icon btn-ghost btn-sm" onClick={() => removeSet(s)} title="Supprimer la série"><Icon.X /></button> : null}
                  </span>
                </div>
              );
            })}
          </div>
          {!finished ? <button className="btn btn-ghost btn-sm mt-8" onClick={() => addSet(we)}><Icon.Plus /> Ajouter une série</button> : null}
        </section>
      ))}

      {!finished ? (
        <div className="row wrap mt-16">
          <button className="btn" onClick={() => setPicker(true)}><Icon.Plus /> Ajouter un exercice</button>
          <span className="grow" />
          <button className="btn btn-ghost" onClick={() => setCancelAsk(true)}>Annuler la séance</button>
          <button className="btn btn-primary" onClick={() => setFinishing(true)} disabled={done === 0}><Icon.Check /> Terminer</button>
        </div>
      ) : (
        <section className="section card card-pad mt-16">
          <h3 className="mb-12">Notes et ressenti</h3>
          <div className="row wrap mb-12">{MOODS.map(([e, l]) => <button key={e} className={'tab' + (mood === e ? ' active' : '')} onClick={() => setMood(e)} title={l}>{e} {l}</button>)}</div>
          <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Comment s'est passée la séance ?" />
          <div className="row wrap mt-12"><button className="btn" onClick={saveNotes}>Enregistrer</button><button className="btn btn-primary" onClick={repeat}><Icon.Repeat /> Refaire cette séance</button><span className="grow" /><button className="btn btn-ghost" onClick={() => setCancelAsk(true)}><Icon.Trash /> Supprimer</button></div>
        </section>
      )}

      {rest ? <div className="rest-overlay" onClick={() => setRest(null)}><div onClick={(e) => e.stopPropagation()}><RestTimer key={rest.key} seconds={rest.seconds} onDone={() => setRest(null)} /></div></div> : null}

      <ExercisePicker open={picker} onClose={() => setPicker(false)} multiple onPick={addExercises} />

      <Modal open={finishing} onClose={() => setFinishing(false)} title="Terminer la séance ?">
        <p className="muted mb-12">{done} série{done > 1 ? 's' : ''} validée{done > 1 ? 's' : ''} en {mmss(elapsed)}. Les séries non cochées seront ignorées.</p>
        <div className="row wrap mb-12">{MOODS.map(([e, l]) => <button key={e} className={'tab' + (mood === e ? ' active' : '')} onClick={() => setMood(e)} title={l}>{e}</button>)}</div>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Une note ? (optionnel)" />
        <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setFinishing(false)}>Continuer</button><button className="btn btn-primary" onClick={finish}><Icon.Check /> Terminer</button></div>
      </Modal>

      <Modal open={!!summary} onClose={() => { setSummary(null); navigate('/'); }} title="Séance terminée 🎉">
        {summary ? (<>
          <div className="stats-strip mb-12">
            <div className="stat"><div className="value">{mmss(summary.duration_seconds)}</div><div className="label">Durée</div></div>
            <div className="stat"><div className="value">{summary.stats.sets_done}</div><div className="label">Séries</div></div>
            <div className="stat"><div className="value">{volumeText(summary.stats.volume)}</div><div className="label">Volume</div></div>
          </div>
          {summary.prs?.length ? <div className="pr-box"><b>🏆 Nouveaux records</b><ul>{summary.prs.map((p, i) => <li key={i}>{p.exercise} · {p.kind} : <b>{p.value}</b></li>)}</ul></div> : <p className="muted">Pas de record cette fois, mais chaque séance compte.</p>}
          <div className="modal-actions"><button className="btn btn-primary" onClick={() => { setSummary(null); navigate('/'); }}>Super !</button></div>
        </>) : null}
      </Modal>

      <Modal open={cancelAsk} onClose={() => setCancelAsk(false)} title={finished ? 'Supprimer cette séance ?' : 'Annuler la séance ?'}>
        <p className="muted">Les séries enregistrées seront perdues.</p>
        <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setCancelAsk(false)}>Retour</button><button className="btn btn-danger" onClick={cancel}>{finished ? 'Supprimer' : 'Annuler la séance'}</button></div>
      </Modal>
    </div>
  );
}
