import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { Modal } from '../components/Modal.jsx';
import { ExercisePicker } from '../components/ExercisePicker.jsx';
import { timeAgo } from '../lib/format.js';

const ICONS = ['🏋️', '💪', '🦵', '🔙', '🫁', '🤷', '🎯', '❤️', '🧘', '🏃', '🥊', '⚡'];

export function Routines() {
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [active, setActive] = useState(null);
  const [del, setDel] = useState(null);
  const load = () => api.get('/api/routines').then(setList).catch(setError);
  useEffect(() => { load(); api.get('/api/workouts/active').then(setActive).catch(() => {}); }, []);
  const start = async (rt) => {
    try { const w = await api.post('/api/workouts', { routine_id: rt.id }); navigate(`/workout/${w.id}`); } catch (e) { if (e.status === 409) navigate('/workout/active'); else toast(e.message, 'error'); }
  };
  const remove = async () => { try { await api.del(`/api/routines/${del.id}`); setDel(null); load(); } catch (e) { toast(e.message, 'error'); } };
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Mes routines</h1><p>Vos séances types, prêtes à démarrer en un clic.</p></div>
        <div className="row wrap"><Link to="/programs" className="btn"><Icon.Book /> Programmes</Link><Link to="/routines/new" className="btn btn-primary"><Icon.Plus /> Nouvelle routine</Link></div>
      </div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon="📋" title="Aucune routine" text="Créez une routine ou adoptez un programme prêt à l'emploi." action="Voir les programmes" to="/programs" /> : (
        <div className="list">
          {list.map((rt) => (
            <div key={rt.id} className="list-item routine-row">
              <div className="list-icon">{rt.icon || '🏋️'}</div>
              <div className="grow">
                <div className="list-title">{rt.name}</div>
                <div className="muted small ellipsis">{rt.exercises.map((x) => x.exercise.name).join(' · ') || 'Aucun exercice'}</div>
                <div className="muted small">{rt.exercises.length} exercices · ~{rt.estimated_minutes} min · {rt.times_done ? `faite ${rt.times_done}× · ${timeAgo(rt.last_done_at)}` : 'jamais faite'}</div>
              </div>
              <div className="row">
                <Link to={`/routines/${rt.id}/edit`} className="btn btn-icon btn-ghost" title="Modifier"><Icon.Edit /></Link>
                <button className="btn btn-icon btn-ghost" title="Supprimer" onClick={() => setDel(rt)}><Icon.Trash /></button>
                <button className="btn btn-primary btn-sm" disabled={!!active} onClick={() => start(rt)}><Icon.Play /> Démarrer</button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={!!del} onClose={() => setDel(null)} title="Supprimer cette routine ?">
        <p className="muted">{del?.name}</p>
        <div className="modal-actions"><button className="btn btn-ghost" onClick={() => setDel(null)}>Annuler</button><button className="btn btn-danger" onClick={remove}>Supprimer</button></div>
      </Modal>
    </div>
  );
}

export function RoutineEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const isNew = !id;
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('🏋️');
  const [description, setDescription] = useState('');
  const [exercises, setExercises] = useState([]);
  const [loaded, setLoaded] = useState(isNew);
  const [picker, setPicker] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (isNew) return;
    api.get(`/api/routines/${id}`).then((rt) => { setName(rt.name); setIcon(rt.icon || '🏋️'); setDescription(rt.description || ''); setExercises(rt.exercises.map((x) => ({ exercise_id: x.exercise_id, name: x.exercise.name, unit: x.exercise.unit, sets: x.sets, reps: x.reps, rest_seconds: x.rest_seconds, notes: x.notes || '' }))); setLoaded(true); }).catch((e) => toast(e.message, 'error'));
  }, [id]); // eslint-disable-line
  const update = (i, patch) => setExercises((l) => l.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  const move = (i, dir) => setExercises((l) => { const c = [...l]; const j = i + dir; if (j < 0 || j >= c.length) return l; [c[i], c[j]] = [c[j], c[i]]; return c; });
  const save = async (e) => {
    e.preventDefault();
    if (!name.trim()) return toast('Donnez un nom à la routine', 'error');
    setBusy(true);
    try {
      const body = { name, icon, description, exercises };
      if (isNew) await api.post('/api/routines', body); else await api.put(`/api/routines/${id}`, body);
      toast('Routine enregistrée', 'success');
      navigate('/routines');
    } catch (err) { toast(err.message, 'error'); } finally { setBusy(false); }
  };
  if (!loaded) return <div className="page"><Spinner /></div>;
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => navigate('/routines')}><Icon.Back /> Routines</button>
      <form onSubmit={save}>
        <div className="page-header"><h1>{isNew ? 'Nouvelle routine' : 'Modifier la routine'}</h1><button className="btn btn-primary" disabled={busy}><Icon.Check /> Enregistrer</button></div>
        <div className="card card-pad mb-16">
          <div className="row wrap" style={{ alignItems: 'flex-end' }}>
            <div className="field"><label>Icône</label><div className="avatar-picker">{ICONS.map((i) => <button type="button" key={i} className={icon === i ? 'active' : ''} onClick={() => setIcon(i)}>{i}</button>)}</div></div>
          </div>
          <div className="field mt-12"><label>Nom</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex : Haut du corps" required /></div>
          <div className="field mt-12"><label>Description</label><input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optionnel" /></div>
        </div>
        <div className="section-head"><h2>Exercices <span className="count">{exercises.length}</span></h2><button type="button" className="btn btn-sm" onClick={() => setPicker(true)}><Icon.Plus /> Ajouter</button></div>
        {exercises.length === 0 ? <p className="muted mb-16">Ajoutez des exercices à votre routine.</p> : null}
        {exercises.map((x, i) => (
          <div key={i} className="card card-pad mb-12 editor-row">
            <div className="row">
              <div className="list-num">{i + 1}</div>
              <div className="grow list-title">{x.name}</div>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => move(i, -1)} disabled={i === 0}>↑</button>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => move(i, 1)} disabled={i === exercises.length - 1}>↓</button>
              <button type="button" className="btn btn-icon btn-ghost btn-sm" onClick={() => setExercises((l) => l.filter((_, j) => j !== i))}><Icon.Trash /></button>
            </div>
            <div className="editor-fields mt-12">
              <label>Séries<input className="input" type="number" min={1} max={20} value={x.sets} onChange={(e) => update(i, { sets: Number(e.target.value) })} /></label>
              <label>{x.unit === 'time' ? 'Durée' : x.unit === 'distance' ? 'Distance' : 'Répétitions'}<input className="input" value={x.reps} onChange={(e) => update(i, { reps: e.target.value })} placeholder={x.unit === 'time' ? '30 s' : x.unit === 'distance' ? '5 km' : '8-12'} /></label>
              <label>Repos (s)<input className="input" type="number" min={0} max={600} step={15} value={x.rest_seconds} onChange={(e) => update(i, { rest_seconds: Number(e.target.value) })} /></label>
              <label>Note<input className="input" value={x.notes} onChange={(e) => update(i, { notes: e.target.value })} placeholder="Optionnel" /></label>
            </div>
          </div>
        ))}
      </form>
      <ExercisePicker open={picker} onClose={() => setPicker(false)} multiple onPick={(list) => setExercises((l) => [...l, ...list.map((e) => ({ exercise_id: e.id, name: e.name, unit: e.unit, sets: 3, reps: e.unit === 'time' ? '30 s' : e.unit === 'distance' ? '1 km' : '10', rest_seconds: e.type === 'stretch' ? 15 : 90, notes: '' }))])} />
    </div>
  );
}
