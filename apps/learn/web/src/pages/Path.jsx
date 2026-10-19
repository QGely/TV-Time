import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStatus } from '../lib/status.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';

function darken(hex, amount = 0.22) {
  const n = parseInt(hex.slice(1), 16);
  const f = (c) => Math.max(0, Math.round(c * (1 - amount)));
  return `#${[f(n >> 16), f((n >> 8) & 255), f(n & 255)].map((x) => x.toString(16).padStart(2, '0')).join('')}`;
}
const OFFSETS = [0, 44, 70, 44, 0, -44, -70, -44];

function Node({ skill, unit, index, isStart, open, onToggle, onStart }) {
  const pct = skill.level / skill.levels;
  const r = 50, c = 2 * Math.PI * r;
  const cls = 'path-node ' + (!skill.unlocked ? 'locked' : skill.completed ? 'gold' : 'active') + (isStart ? ' start' : '');
  return (
    <div className={"path-node-wrap" + (open ? " open" : "")} style={{ transform: `translateX(${OFFSETS[index % OFFSETS.length]}px)`, '--node-color': unit.color, '--node-dark': darken(unit.color) }}>
      <button className={cls} onClick={onToggle} aria-label={skill.title}>
        {skill.unlocked && !skill.completed ? <span className="ring"><svg viewBox="0 0 116 116"><circle cx="58" cy="58" r={r} strokeDasharray={c} strokeDashoffset={c * (1 - pct)} /></svg></span> : null}
        <span className="emoji">{skill.unlocked ? skill.icon : <Icon.Lock width={30} height={30} />}</span>
        {skill.completed ? <span className="crown"><Icon.Crown /></span> : skill.level > 0 ? <span className="crown">{skill.level}</span> : null}
      </button>
      <div className="path-label">{skill.title}</div>
      {open ? (
        <div className={'node-popover' + (skill.unlocked ? '' : ' locked')} onClick={(e) => e.stopPropagation()}>
          <h4>{skill.icon} {skill.title}</h4>
          <div className="levels">{Array.from({ length: skill.levels }, (_, i) => <span key={i} className={i < skill.level ? 'on' : ''} />)}</div>
          {!skill.unlocked ? (<><p>Termine la leçon précédente pour débloquer celle-ci.</p><button className="btn" disabled><Icon.Lock /> Verrouillé</button></>) : skill.completed ? (<><p>Leçon maîtrisée · {skill.words} mots{skill.strength < 0.6 ? ' · à réviser' : ''}</p><button className="btn" onClick={() => onStart(true)}>Réviser · +10 XP</button></>) : (<><p>Niveau {skill.level + 1} sur {skill.levels} · {skill.words} mots</p><button className="btn" onClick={() => onStart(false)}>{skill.level ? 'Continuer' : 'Commencer'} · +15 XP</button>{skill.level > 0 ? <button className="btn" onClick={() => onStart(true)}>Réviser · +10 XP</button> : null}</>)}
          {skill.has_tips ? <Link to={`/skill/${unit.courseId}/${skill.id}`} className="btn" style={{ marginTop: 8 }}><Icon.Book /> Guide et vocabulaire</Link> : null}
        </div>
      ) : null}
    </div>
  );
}

export function Path() {
  const { user } = useAuth();
  const { status, refresh } = useStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const [course, setCourse] = useState(null);
  const [courses, setCourses] = useState(null);
  const [error, setError] = useState(null);
  const [open, setOpen] = useState(null);
  const [tips, setTips] = useState(null);
  const [board, setBoard] = useState(null);

  useEffect(() => {
    let c = false;
    (async () => {
      try {
        const list = await api.get('/api/courses');
        if (c) return;
        setCourses(list);
        const id = user.current_course && list.find((x) => x.id === user.current_course) ? user.current_course : list[0]?.id;
        if (!id) { setCourse(false); return; }
        setCourse(await api.get(`/api/courses/${id}`));
        api.get('/api/profile/leaderboard').then((b) => !c && setBoard(b)).catch(() => {});
      } catch (e) { setError(e); }
    })();
    return () => { c = true; };
  }, [user.current_course]);

  useEffect(() => { const h = () => setOpen(null); window.addEventListener('click', h); return () => window.removeEventListener('click', h); }, []);

  const start = async (skill, practice) => {
    if (!practice && course.hearts?.hearts <= 0) { toast('Plus de cœurs ! Fais une révision pour en récupérer.', 'error'); return; }
    navigate(`/lesson/${course.id}/${skill.id}${practice ? '?practice=1' : ''}`);
  };

  const firstActive = useMemo(() => course?.next_skill?.id, [course]);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (course === false) return <div className="page"><Empty icon="📚" title="Aucun cours disponible" text="Les fichiers de cours sont absents du serveur." /></div>;
  if (!course) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="path-layout">
        <div>
          {course.units.map((u, ui) => (
            <section key={u.id}>
              <div className="unit-banner" style={{ background: u.color }}>
                <div><div className="eyebrow">Unité {ui + 1}</div><h2>{u.title}</h2><div className="small" style={{ opacity: .9 }}>{u.description}</div></div>
                <button className="btn btn-sm" onClick={() => setTips(u)}><Icon.Book /> Guide</button>
              </div>
              <div className="path">
                {u.skills.map((s, i) => (
                  <Node key={s.id} skill={s} unit={{ ...u, courseId: course.id }} index={i} isStart={s.id === firstActive} open={open === s.id} onToggle={(e) => { e.stopPropagation(); setOpen(open === s.id ? null : s.id); }} onStart={(p) => start(s, p)} />
                ))}
                <div className="unit-end" title="Fin de l'unité">{u.skills.every((s) => s.completed) ? '🏆' : '🏁'}</div>
              </div>
            </section>
          ))}
        </div>
        <aside className="path-side">
          <div className="side-card">
            <div className="row" style={{ justifyContent: 'space-between' }}><h3>{course.flag} {course.title}</h3><Link to="/courses" className="link-btn small">Changer</Link></div>
            <div className="progress mt-8"><div style={{ width: `${course.percent}%` }} /></div>
            <div className="muted small mt-8">{course.percent} % du cours · {course.word_count} mots · {course.xp} XP</div>
          </div>
          <div className="side-card">
            <div className="side-stat"><span className="ico" style={{ background: '#fff0dd' }}>🔥</span><div><b>{course.streak.current} jour{course.streak.current > 1 ? 's' : ''}</b><span>{course.streak.active_today ? 'Série prolongée aujourd’hui' : 'Fais une leçon pour prolonger ta série'}</span></div></div>
            <div className="side-stat"><span className="ico" style={{ background: '#fff4c4' }}>⚡</span><div><b>{course.xp_today} / {course.daily_goal} XP</b><span>Objectif du jour</span></div></div>
            <div className="progress" style={{ height: 10 }}><div style={{ width: `${Math.min(100, (course.xp_today / course.daily_goal) * 100)}%`, background: 'var(--yellow)' }} /></div>
            <div className="side-stat"><span className="ico" style={{ background: '#ffdfe0' }}>❤️</span><div><b>{course.hearts.hearts} / {course.hearts.max}</b><span>{course.hearts.hearts < course.hearts.max ? 'Récupère un cœur en révisant' : 'Tous tes cœurs sont là'}</span></div></div>
          </div>
          {course.weak_skills.length ? <div className="side-card"><h3>À réviser</h3><p className="muted small mb-12">{course.weak_skills.length} leçon{course.weak_skills.length > 1 ? 's' : ''} perdent en force.</p><Link to="/practice" className="btn btn-blue btn-block btn-sm"><Icon.Dumbbell /> Réviser maintenant</Link></div> : null}
          {board && board.length > 1 ? (
            <div className="side-card"><h3>Classement de la semaine</h3>{board.slice(0, 5).map((b, i) => <div key={b.user.id} className={'leader-row' + (b.user.id === user.id ? ' me' : '')} style={{ padding: '6px 4px' }}><span className={'rank' + (i === 0 ? ' top' : '')}>{i + 1}</span><Avatar user={b.user} /><span className="grow ellipsis" style={{ fontWeight: 700 }}>{b.user.display_name}</span><span className="xp">{b.week_xp} XP</span></div>)}</div>
          ) : null}
        </aside>
      </div>
      <Modal open={!!tips} onClose={() => setTips(null)} title={tips ? `Unité : ${tips.title}` : ''}>
        {tips ? (<>
          <p className="muted mb-12">{tips.description}</p>
          <div className="list">{tips.skills.map((s) => <Link key={s.id} to={`/skill/${course.id}/${s.id}`} className="list-item"><span style={{ fontSize: 24 }}>{s.icon}</span><div className="grow"><div className="list-title">{s.title}</div><div className="muted small">{s.words} mots · niveau {s.level}/{s.levels}</div></div><Icon.Book /></Link>)}</div>
        </>) : null}
      </Modal>
    </div>
  );
}
