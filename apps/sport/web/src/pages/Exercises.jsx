import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { BodyDiagram, MUSCLE_LABELS } from '../components/BodyDiagram.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { Modal } from '../components/Modal.jsx';
import { CATEGORY_ICONS, fmtDate, kg, mmss, distanceText } from '../lib/format.js';

export function Exercises() {
  const [params, setParams] = useSearchParams();
  const [list, setList] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const q = params.get('q') || '';
  const category = params.get('category') || '';
  const equipment = params.get('equipment') || '';
  const muscle = params.get('muscle') || '';
  useEffect(() => {
    api.get('/api/exercises/meta').then(setMeta).catch(setError);
    api.get('/api/exercises').then(setList).catch(setError);
  }, []);
  const set = (patch) => { const next = { q, category, equipment, muscle, ...patch }; setParams(Object.fromEntries(Object.entries(next).filter(([, v]) => v)), { replace: true }); };
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((e) => (!category || e.category === category) && (!equipment || e.equipment === equipment) && (!muscle || e.primary_muscles.includes(muscle) || e.secondary_muscles.includes(muscle)) && (!s || e.name.toLowerCase().includes(s) || (e.name_en || '').toLowerCase().includes(s)));
  }, [list, q, category, equipment, muscle]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  return (
    <div className="page">
      <div className="page-header"><div><h1>Exercices</h1><p>{list ? `${list.length} exercices avec schémas musculaires et consignes.` : ''}</p></div></div>
      <div className="searchbar mb-12"><Icon.Search /><input className="input" placeholder="Rechercher un exercice…" value={q} onChange={(e) => set({ q: e.target.value })} />{q ? <button className="clear" onClick={() => set({ q: '' })}><Icon.X /></button> : null}</div>
      {meta ? (
        <>
          <div className="tabs mb-12">
            <button className={'tab' + (!category ? ' active' : '')} onClick={() => set({ category: '' })}>Tous</button>
            {Object.entries(meta.categories).map(([k, v]) => <button key={k} className={'tab' + (category === k ? ' active' : '')} onClick={() => set({ category: category === k ? '' : k })}>{CATEGORY_ICONS[k]} {v}</button>)}
          </div>
          <div className="row wrap mb-16">
            <select className="input" style={{ width: 'auto' }} value={equipment} onChange={(e) => set({ equipment: e.target.value })}><option value="">Tout matériel</option>{Object.entries(meta.equipment).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <select className="input" style={{ width: 'auto' }} value={muscle} onChange={(e) => set({ muscle: e.target.value })}><option value="">Tous les muscles</option>{Object.entries(meta.muscles).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            <span className="muted small">{filtered.length} résultat{filtered.length > 1 ? 's' : ''}</span>
          </div>
        </>
      ) : null}
      {!list ? <Spinner /> : filtered.length === 0 ? <Empty icon="🔍" title="Aucun exercice" text="Essayez un autre filtre." /> : (
        <div className="ex-grid">
          {filtered.map((e) => (
            <Link key={e.id} to={`/exercises/${e.id}`} className="ex-card">
              <div className="ex-thumb"><BodyDiagram primary={e.primary_muscles} secondary={e.secondary_muscles} size="xs" /></div>
              <div className="grow">
                <div className="ex-name">{e.name}</div>
                <div className="ex-meta"><span className="chip">{CATEGORY_ICONS[e.category]} {meta?.categories[e.category]}</span><span className="chip">{meta?.equipment[e.equipment]}</span></div>
                <div className="muted small clamp-2 mt-8">{e.primary_muscles.map((m) => MUSCLE_LABELS[m]).join(', ')}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ExerciseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [ex, setEx] = useState(null);
  const [meta, setMeta] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [confirm, setConfirm] = useState(false);
  useEffect(() => {
    setEx(null);
    api.get(`/api/exercises/${id}`).then(setEx).catch(setError);
    api.get('/api/exercises/meta').then(setMeta).catch(() => {});
    api.get('/api/workouts/active').then(setActive).catch(() => {});
  }, [id]);
  if (error) return <div className="page"><button className="btn btn-ghost mb-16" onClick={() => navigate(-1)}><Icon.Back /> Retour</button><ErrorBox error={error} /></div>;
  if (!ex) return <div className="page"><Spinner /></div>;

  const addToActive = async () => {
    try { await api.post(`/api/workouts/${active.id}/exercises`, { exercise_id: ex.id }); toast('Ajouté à la séance en cours', 'success'); navigate(`/workout/${active.id}`); } catch (e) { toast(e.message, 'error'); }
  };
  const startWith = async () => {
    try { const w = await api.post('/api/workouts', { name: ex.name }); await api.post(`/api/workouts/${w.id}/exercises`, { exercise_id: ex.id }); navigate(`/workout/${w.id}`); } catch (e) { toast(e.message, 'error'); }
  };
  const remove = async () => { try { await api.del(`/api/exercises/${ex.id}`); toast('Exercice supprimé', 'success'); navigate('/exercises'); } catch (e) { toast(e.message, 'error'); } };

  const maxVal = Math.max(1, ...ex.history.map((h) => (ex.unit === 'reps' ? (h.best_weight || h.max_reps) : ex.unit === 'time' ? h.max_seconds : h.max_distance)));
  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/exercises'))}><Icon.Back /> Exercices</button>
      <div className="page-header">
        <div><h1>{ex.name}</h1><p>{ex.name_en && ex.name_en !== ex.name ? ex.name_en + ' · ' : ''}{meta?.categories[ex.category]} · {meta?.equipment[ex.equipment]} · {meta?.levels[ex.level]}</p></div>
        <div className="row wrap">
          {active ? <button className="btn btn-primary" onClick={addToActive}><Icon.Plus /> Ajouter à la séance</button> : <button className="btn btn-primary" onClick={startWith}><Icon.Play /> Démarrer avec cet exercice</button>}
          {ex.source === 'custom' ? <button className="btn btn-ghost" onClick={() => setConfirm(true)}><Icon.Trash /></button> : null}
        </div>
      </div>
      <div className="detail-grid">
        <div>
          <section className="section card card-pad">
            <h3 className="mb-12">Muscles sollicités</h3>
            <div className="row wrap" style={{ alignItems: 'flex-start' }}>
              <BodyDiagram primary={ex.primary_muscles} secondary={ex.secondary_muscles} size="lg" />
              <div className="grow">
                <div className="muted small mb-8">Principaux</div>
                <div className="row wrap mb-12">{ex.primary_muscles.map((m) => <span key={m} className="chip chip-accent">{MUSCLE_LABELS[m]}</span>)}{!ex.primary_muscles.length ? <span className="muted small">—</span> : null}</div>
                <div className="muted small mb-8">Secondaires</div>
                <div className="row wrap">{ex.secondary_muscles.map((m) => <span key={m} className="chip">{MUSCLE_LABELS[m]}</span>)}{!ex.secondary_muscles.length ? <span className="muted small">—</span> : null}</div>
              </div>
            </div>
          </section>
          {ex.instructions.length ? (
            <section className="section">
              <h3 className="mb-12">Exécution</h3>
              <ol className="steps">{ex.instructions.map((s, i) => <li key={i}>{s}</li>)}</ol>
            </section>
          ) : null}
          {ex.tips ? <section className="section"><div className="tip-box">💡 {ex.tips}</div></section> : null}
          {ex.mistakes.length ? (
            <section className="section">
              <h3 className="mb-12">Erreurs fréquentes</h3>
              <ul className="mistakes">{ex.mistakes.map((s, i) => <li key={i}>⚠️ {s}</li>)}</ul>
            </section>
          ) : null}
        </div>
        <aside>
          <section className="section">
            <h3 className="mb-12">Vos records</h3>
            <div className="stats-strip" style={{ gridTemplateColumns: '1fr 1fr' }}>
              {ex.unit === 'reps' ? (<>
                <div className="stat"><div className="value">{ex.pr.weight ? kg(ex.pr.weight, user.weight_unit) : '—'}</div><div className="label">Charge max</div></div>
                <div className="stat"><div className="value">{ex.pr.e1rm ? kg(ex.pr.e1rm, user.weight_unit) : '—'}</div><div className="label">1RM estimé</div></div>
                <div className="stat"><div className="value">{ex.pr.reps || '—'}</div><div className="label">Reps max</div></div>
                <div className="stat"><div className="value">{ex.history.length}</div><div className="label">Séances</div></div>
              </>) : ex.unit === 'time' ? (<>
                <div className="stat"><div className="value">{ex.pr.seconds ? mmss(ex.pr.seconds) : '—'}</div><div className="label">Durée max</div></div>
                <div className="stat"><div className="value">{ex.history.length}</div><div className="label">Séances</div></div>
              </>) : (<>
                <div className="stat"><div className="value">{distanceText(ex.pr.distance_m)}</div><div className="label">Distance max</div></div>
                <div className="stat"><div className="value">{ex.history.length}</div><div className="label">Séances</div></div>
              </>)}
            </div>
          </section>
          {ex.history.length ? (
            <section className="section">
              <h3 className="mb-12">Progression</h3>
              <div className="card card-pad">
                <div className="bars" style={{ height: 90 }}>
                  {ex.history.slice(-16).map((h) => {
                    const v = ex.unit === 'reps' ? (h.best_weight || h.max_reps) : ex.unit === 'time' ? h.max_seconds : h.max_distance;
                    return <div key={h.workout_id} className="bar" title={`${fmtDate(h.date, 'short')} · ${ex.unit === 'reps' ? (h.best_weight ? kg(h.best_weight, user.weight_unit) + ' × ' + h.max_reps : h.max_reps + ' reps') : ex.unit === 'time' ? mmss(h.max_seconds) : distanceText(h.max_distance)}`}><div className="fill" style={{ height: `${Math.max(3, (v / maxVal) * 100)}%` }} /></div>;
                  })}
                </div>
                <div className="muted small mt-8">Dernière séance : {fmtDate(ex.last.date, 'short')} · {ex.last.sets.map((s) => (ex.unit === 'reps' ? `${s.reps || 0}${s.weight ? '×' + s.weight : ''}` : ex.unit === 'time' ? mmss(s.seconds) : distanceText(s.distance_m))).join(' · ')}</div>
              </div>
            </section>
          ) : null}
        </aside>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Supprimer cet exercice ?">
        <p className="muted">Les séances passées conserveront leurs séries.</p>
        <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Annuler</button><button className="btn btn-danger" onClick={remove}>Supprimer</button></div>
      </Modal>
    </div>
  );
}
