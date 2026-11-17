import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStatus } from '../lib/status.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { speak, canSpeak, LETTERS } from '../lib/format.js';

export function Courses() {
  const { user, setUser } = useAuth();
  const { refresh } = useStatus();
  const navigate = useNavigate();
  const toast = useToast();
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => { api.get('/api/courses').then(setList).catch(setError); }, []);
  const choose = async (c) => {
    try { const r = await api.put('/api/auth/me', { current_course: c.id }); setUser(r.user); refresh(); navigate('/'); } catch (e) { toast(e.message, 'error'); }
  };
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!list) return <div className="page"><Spinner /></div>;
  return (
    <div className="page">
      <div className="page-header"><div><h1>Cours</h1><p>Choisis ce que tu veux apprendre : une langue ou une préparation d'examen. Tu peux en suivre plusieurs.</p></div></div>
      {list.length === 0 ? <Empty icon="📚" title="Aucun cours" text="Ajoutez des fichiers de cours sur le serveur." /> : (
        <div className="course-grid">
          {list.map((c) => (
            <button key={c.id} className={'course-card' + (user.current_course === c.id ? ' current' : '')} onClick={() => choose(c)}>
              <div className="flag">{c.flag}</div>
              <h3>{c.title}</h3>
              <p className="muted small clamp-2">{c.description}</p>
              <div className="progress mt-12" style={{ height: 10 }}><div style={{ width: `${c.percent}%` }} /></div>
              <div className="muted small mt-8">{c.skill_count} leçons · {c.type === 'quiz' ? `${c.question_count} questions` : `${c.word_count} mots`}{c.xp ? ` · ${c.xp} XP` : ''}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function SkillDetail() {
  const { courseId, skillId } = useParams();
  const navigate = useNavigate();
  const [skill, setSkill] = useState(null);
  const [course, setCourse] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    api.get(`/api/courses/${courseId}/skills/${skillId}`).then(setSkill).catch(setError);
    api.get('/api/courses').then((l) => setCourse(l.find((c) => c.id === courseId))).catch(() => {});
  }, [courseId, skillId]);
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!skill) return <div className="page"><Spinner /></div>;
  const tts = skill.tts_lang || null;
  if (skill.course_type === 'quiz') return <QuizSkill skill={skill} courseId={courseId} skillId={skillId} navigate={navigate} />;
  return (
    <div className="page" style={{ maxWidth: 820 }}>
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => navigate('/')}><Icon.Back /> Retour au parcours</button>
      <div className="page-header">
        <div><h1>{skill.icon} {skill.title}</h1><p>{skill.unit.title} · niveau {skill.level}/{skill.levels} · {skill.vocab.length} mots</p></div>
        <div className="row wrap">{skill.level < skill.levels ? <Link to={`/lesson/${courseId}/${skillId}`} className="btn btn-primary">Commencer</Link> : null}{skill.level > 0 ? <Link to={`/lesson/${courseId}/${skillId}?practice=1`} className="btn">Réviser</Link> : null}</div>
      </div>
      {skill.tips ? <section className="section"><h2 className="mb-12">Guide</h2><div className="tips-box">{skill.tips}</div></section> : null}
      <section className="section">
        <h2 className="mb-12">Vocabulaire</h2>
        <div className="vocab-grid">
          {skill.vocab.map((v) => (
            <button key={v.term} className="vocab-item" onClick={() => speak(v.term, tts)} title={canSpeak() ? 'Écouter' : ''}>
              <span className="e">{v.emoji || '🔊'}</span>
              <span className="grow" style={{ textAlign: 'left' }}><b>{v.term}</b><span>{v.translation}</span></span>
            </button>
          ))}
        </div>
      </section>
      <section className="section">
        <h2 className="mb-12">Phrases</h2>
        <div className="list">{skill.sentences.map((s, i) => <button key={i} className="list-item" onClick={() => speak(s.source, tts)} style={{ textAlign: 'left' }}><Icon.Speaker /><div className="grow"><div className="list-title">{s.source}</div><div className="muted small">{s.target}</div></div></button>)}</div>
      </section>
    </div>
  );
}

function QuizQuestion({ q, n }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="qa-card">
      <div className="qa-q"><span className="qa-n">{n}</span>{q.q}</div>
      <ol className="qa-choices">
        {q.choices.map((c, i) => <li key={i} className={shown && i === q.answer ? 'right' : ''}><b>{LETTERS[i]}</b> {c}</li>)}
      </ol>
      {shown ? <div className="qa-expl">✅ {LETTERS[q.answer]} — {q.explanation}</div> : <button className="link-btn small" onClick={() => setShown(true)}>Voir la réponse</button>}
    </div>
  );
}

function QuizSkill({ skill, courseId, skillId, navigate }) {
  const [showAll, setShowAll] = useState(false);
  return (
    <div className="page" style={{ maxWidth: 860 }}>
      <button className="btn btn-ghost btn-sm mb-12" onClick={() => navigate('/')}><Icon.Back /> Retour au parcours</button>
      <div className="page-header">
        <div><h1>{skill.icon} {skill.title}</h1><p>{skill.unit.title} · niveau {skill.level}/{skill.levels} · {skill.questions.length} questions</p></div>
        <div className="row wrap">{skill.level < skill.levels ? <Link to={`/lesson/${courseId}/${skillId}`} className="btn btn-primary">{skill.level ? 'Continuer' : 'Commencer'}</Link> : null}{skill.level > 0 ? <Link to={`/lesson/${courseId}/${skillId}?practice=1`} className="btn">Réviser</Link> : null}</div>
      </div>
      {skill.tips ? <section className="section"><h2 className="mb-12">Fiche de cours</h2><div className="tips-box fiche">{skill.tips}</div></section> : null}
      {skill.vocab.length ? (
        <section className="section">
          <h2 className="mb-12">Glossaire</h2>
          <div className="glossary">{skill.vocab.map((v) => <div key={v.term} className="glossary-row"><b>{v.term}</b><span>{v.translation}</span></div>)}</div>
        </section>
      ) : null}
      <section className="section">
        <div className="section-head"><h2>Questions et corrigés</h2><button className="link-btn small" onClick={() => setShowAll((v) => !v)}>{showAll ? 'Masquer les réponses' : 'Tout afficher'}</button></div>
        <div className="list" key={showAll ? 'all' : 'hidden'}>{skill.questions.map((q, i) => showAll ? (
          <div key={q.id} className="qa-card">
            <div className="qa-q"><span className="qa-n">{i + 1}</span>{q.q}</div>
            <ol className="qa-choices">{q.choices.map((c, j) => <li key={j} className={j === q.answer ? 'right' : ''}><b>{LETTERS[j]}</b> {c}</li>)}</ol>
            <div className="qa-expl">✅ {LETTERS[q.answer]} — {q.explanation}</div>
          </div>
        ) : <QuizQuestion key={q.id} q={q} n={i + 1} />)}</div>
      </section>
    </div>
  );
}
