import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';

const GOALS = { force: 'Force', muscle: 'Prise de muscle', 'perte-de-poids': 'Perte de poids', endurance: 'Endurance', mobilite: 'Mobilité', maison: 'À la maison' };
const LEVELS = { debutant: 'Débutant', intermediaire: 'Intermédiaire', avance: 'Avancé' };

export function Programs() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/api/programs').then(setList).catch(setError); }, []);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  return (
    <div className="page">
      <div className="page-header"><div><h1>Programmes</h1><p>Des plans prêts à l'emploi : adoptez-en un, il devient vos routines.</p></div></div>
      {!list ? <Spinner /> : list.length === 0 ? <Empty icon="📚" title="Aucun programme" text="Les fichiers de programmes sont absents du serveur." /> : (
        <div className="coll-grid">
          {list.map((p) => (
            <Link key={p.id} to={`/programs/${p.id}`} className="program-card">
              <div className="program-icon">{p.icon}</div>
              <div className="grow">
                <div className="program-name">{p.name}</div>
                <div className="muted small clamp-2">{p.description}</div>
                <div className="row wrap mt-8"><span className="chip chip-accent">{LEVELS[p.level]}</span><span className="chip">{GOALS[p.goal] || p.goal}</span><span className="chip">{p.days_per_week} j/sem</span>{p.adopted ? <span className="chip chip-green">Adopté</span> : null}</div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

export function ProgramDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [p, setP] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { api.get(`/api/programs/${id}`).then(setP).catch(setError); }, [id]);
  const adopt = async () => {
    setBusy(true);
    try { await api.post(`/api/programs/${id}/adopt`); toast('Programme ajouté à vos routines', 'success'); navigate('/routines'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!p) return <div className="page"><Spinner /></div>;
  return (
    <div className="page">
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => navigate('/programs')}><Icon.Back /> Programmes</button>
      <div className="page-header">
        <div className="row" style={{ alignItems: 'flex-start' }}>
          <div className="program-icon lg">{p.icon}</div>
          <div><h1>{p.name}</h1><p>{p.description}</p><div className="row wrap mt-8"><span className="chip chip-accent">{LEVELS[p.level]}</span><span className="chip">{GOALS[p.goal] || p.goal}</span><span className="chip">{p.days_per_week} jours / semaine</span><span className="chip">{p.weeks} semaines</span></div></div>
        </div>
        <button className="btn btn-primary" onClick={adopt} disabled={busy}><Icon.Plus /> {p.adopted ? 'Réinitialiser mes routines' : 'Adopter ce programme'}</button>
      </div>
      {p.days.map((d, i) => (
        <section key={i} className="section card card-pad">
          <h3>{d.name}</h3>
          {d.focus ? <p className="muted small mb-12">{d.focus}</p> : null}
          <div className="list">
            {d.exercises.map((x, j) => (
              <div key={j} className="list-item">
                <div className="list-num">{j + 1}</div>
                <div className="grow">{x.exercise ? <Link to={`/exercises/${x.exercise.id}`} className="list-title">{x.exercise.name}</Link> : <span className="list-title muted">{x.exercise_id}</span>}{x.notes ? <div className="muted small">{x.notes}</div> : null}</div>
                <div className="muted small">{x.sets} × {x.reps} · repos {x.rest_seconds} s</div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
