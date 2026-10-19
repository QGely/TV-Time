import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';

export function Practice() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const toast = useToast();
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    (async () => {
      try {
        const list = await api.get('/api/courses');
        const id = user.current_course && list.find((x) => x.id === user.current_course) ? user.current_course : list[0]?.id;
        if (!id) return setCourse(false);
        setCourse(await api.get(`/api/courses/${id}`));
      } catch (e) { setError(e); }
    })();
  }, [user.current_course]);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (course === false) return <div className="page"><Empty icon="📚" title="Aucun cours" /></div>;
  if (!course) return <div className="page"><Spinner /></div>;
  const started = course.units.flatMap((u) => u.skills.map((s) => ({ ...s, unit: u }))).filter((s) => s.level > 0);
  const weak = started.filter((s) => course.weak_skills.includes(s.id));
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <div className="page-header"><div><h1>Réviser</h1><p>Renforce ce que tu as appris. Une révision réussie te rend un cœur ❤️.</p></div></div>
      {started.length === 0 ? <Empty icon="🌱" title="Rien à réviser pour l'instant" text="Commence une leçon sur le parcours, puis reviens ici." action="Aller au parcours" to="/" /> : (
        <>
          <div className="card card-pad mb-16 row wrap">
            <div className="grow"><h3>Révision mixte</h3><p className="muted small">Un mélange des leçons qui en ont le plus besoin.</p></div>
            <button className="btn btn-blue" onClick={() => navigate(`/lesson/${course.id}/_mixed?practice=1`)}><Icon.Dumbbell /> Lancer · +10 XP</button>
          </div>
          {weak.length ? <h2 className="mb-12">À renforcer ({weak.length})</h2> : <h2 className="mb-12">Toutes tes leçons</h2>}
          <div className="list">
            {(weak.length ? weak : started).map((s) => (
              <div key={s.id} className="list-item">
                <span style={{ fontSize: 26 }}>{s.icon}</span>
                <div className="grow"><div className="list-title">{s.title}</div><div className="muted small">{s.unit.title} · force {Math.round(s.strength * 100)} % · niveau {s.level}/{s.levels}</div><div className="progress mt-8" style={{ height: 8, maxWidth: 220 }}><div style={{ width: `${s.strength * 100}%`, background: s.strength < 0.6 ? 'var(--orange)' : 'var(--green)' }} /></div></div>
                <Link to={`/lesson/${course.id}/${s.id}?practice=1`} className="btn btn-sm">Réviser</Link>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
