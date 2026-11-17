import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStatus } from '../lib/status.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { fmtDate, mmss, durationLabel, LETTERS } from '../lib/format.js';

/** Picks the course whose exam is shown: the current course if it has one, else the first course with an exam. */
function useExamCourse() {
  const { user } = useAuth();
  const [courseId, setCourseId] = useState(undefined);
  useEffect(() => {
    api.get('/api/courses').then((list) => {
      const withExam = list.filter((c) => c.has_exam);
      setCourseId((withExam.find((c) => c.id === user.current_course) || withExam[0])?.id || null);
    }).catch(() => setCourseId(null));
  }, [user.current_course]);
  return courseId;
}

export function ExamHome() {
  const courseId = useExamCourse();
  const navigate = useNavigate();
  const toast = useToast();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);

  useEffect(() => {
    if (!courseId) return;
    api.get(`/api/exams/${courseId}`).then(setData).catch(setError);
  }, [courseId]);

  const start = async (unit) => {
    setBusy(true);
    try {
      const exam = await api.post(`/api/exams/${courseId}`, unit ? { unit } : {});
      navigate(`/exam/${courseId}/${exam.id}`);
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setConfirm(null); }
  };

  if (courseId === null) return <div className="page"><Empty icon="📝" title="Aucun examen disponible" text="Les examens blancs sont proposés pour les cours de préparation (par exemple LAPL/PPL)." action="Voir les cours" to="/courses" /></div>;
  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;
  const f = data.format;
  const lastFull = data.history.find((h) => h.mode === 'full');

  return (
    <div className="page" style={{ maxWidth: 960 }}>
      <div className="page-header">
        <div><h1>📝 Examen blanc · {data.course.title}</h1><p>Format officiel : {f.subjects.length} épreuves, {f.total_questions} questions, {durationLabel(f.total_minutes)}. Il faut au moins {f.pass_percent} % dans <b>chaque</b> matière.</p></div>
      </div>

      {data.active ? (
        <div className="card card-pad mb-16 row wrap exam-resume">
          <div className="grow"><b>Un examen est en cours</b><div className="muted small">{data.active.mode === 'full' ? 'Examen complet' : f.subjects.find((s) => s.unit === data.active.unit_id)?.title} · {mmss(data.active.remaining_seconds)} restantes</div></div>
          <Link to={`/exam/${courseId}/${data.active.id}`} className="btn btn-blue">Reprendre</Link>
        </div>
      ) : null}

      <div className="exam-hero">
        <div>
          <h2>Examen complet</h2>
          <p className="muted">{f.total_questions} questions tirées au hasard dans toutes les matières, chronométrées comme le jour J. Corrigé détaillé à la fin.</p>
          {lastFull ? <p className="small mt-8">Dernier essai : <b>{Math.round((lastFull.correct / lastFull.total) * 100)} %</b> · {lastFull.passed ? '✅ réussi' : '❌ non réussi'} · {fmtDate(lastFull.finished_at)}</p> : null}
        </div>
        <button className="btn btn-primary" disabled={busy} onClick={() => setConfirm({ unit: null, title: 'Examen complet', questions: f.total_questions, minutes: f.total_minutes })}><Icon.Exam /> Commencer · {durationLabel(f.total_minutes)}</button>
      </div>

      <h2 className="mb-12 mt-16">Par matière</h2>
      <div className="exam-table">
        <div className="exam-row head"><span>Matière</span><span>Questions</span><span>Durée</span><span>Meilleur score</span><span /></div>
        {f.subjects.map((s) => {
          const best = data.best[s.unit];
          return (
            <div key={s.unit} className="exam-row">
              <span className="subj"><i style={{ background: s.color }} />{s.title}</span>
              <span>{s.questions}<small className="muted"> / {s.available} dispo.</small></span>
              <span>{s.minutes} min</span>
              <span>{best ? <span className={'chip ' + (best.passed ? 'chip-green' : 'chip-red')}>{best.percent} %</span> : <span className="muted small">—</span>}</span>
              <span><button className="btn btn-sm" disabled={busy || s.available < 1} onClick={() => setConfirm({ unit: s.unit, title: s.title, questions: Math.min(s.questions, s.available), minutes: s.minutes })}>S'entraîner</button></span>
            </div>
          );
        })}
        <div className="exam-row total"><span>Total</span><span>{f.total_questions}</span><span>{durationLabel(f.total_minutes)}</span><span /><span /></div>
      </div>
      <p className="muted small mt-8">Format en vigueur depuis le 4 décembre 2023 (source : DGAC). {data.course.disclaimer}</p>

      {data.history.length ? (
        <section className="section mt-16">
          <h2 className="mb-12">Historique</h2>
          <div className="list">
            {data.history.map((h) => (
              <Link key={h.id} to={`/exam/${courseId}/${h.id}`} className="list-item">
                <span className={'exam-badge ' + (h.passed ? 'ok' : 'ko')}>{h.passed ? '✓' : '✗'}</span>
                <div className="grow">
                  <div className="list-title">{h.mode === 'full' ? 'Examen complet' : f.subjects.find((s) => s.unit === h.unit_id)?.title || 'Matière'} · {Math.round((h.correct / h.total) * 100)} %</div>
                  <div className="muted small">{fmtDate(h.finished_at, 'long')} · {h.correct}/{h.total} bonnes réponses{h.mode === 'full' ? ` · ${h.subjects.filter((s) => s.passed).length}/${h.subjects.length} matières validées` : ''}</div>
                </div>
                <Icon.ChevronRight />
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm?.title}>
        {confirm ? (<>
          <p className="muted">{confirm.questions} questions · {durationLabel(confirm.minutes)}. Le chronomètre démarre tout de suite et l'épreuve est corrigée automatiquement à la fin du temps. Tu peux naviguer entre les questions et en marquer pour y revenir.</p>
          <div className="modal-actions"><button className="btn" onClick={() => setConfirm(null)}>Annuler</button><button className="btn btn-primary" disabled={busy} onClick={() => start(confirm.unit)}>C'est parti</button></div>
        </>) : null}
      </Modal>
    </div>
  );
}

export function ExamRun() {
  const { courseId, examId } = useParams();
  const [exam, setExam] = useState(null);
  const [error, setError] = useState(null);
  const load = useCallback(() => api.get(`/api/exams/${courseId}/${examId}`).then(setExam).catch(setError), [courseId, examId]);
  useEffect(() => { load(); }, [load]);
  if (error) return <div className="lesson"><ErrorBox error={error} /><Link to="/exam" className="btn mt-16">Retour</Link></div>;
  if (!exam) return <div className="lesson"><Spinner /></div>;
  return exam.finished_at ? <ExamResults exam={exam} /> : <ExamRunner exam={exam} onDone={setExam} />;
}

function ExamRunner({ exam, onDone }) {
  const navigate = useNavigate();
  const toast = useToast();
  const { refresh } = useStatus();
  const [answers, setAnswers] = useState(exam.answers || {});
  const [flags, setFlags] = useState({});
  const [idx, setIdx] = useState(0);
  const [remaining, setRemaining] = useState(exam.remaining_seconds);
  const [submitAsk, setSubmitAsk] = useState(false);
  const [quitAsk, setQuitAsk] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showGrid, setShowGrid] = useState(false);
  const saveTimer = useRef(null);
  const answersRef = useRef(answers);
  answersRef.current = answers;
  const q = exam.questions[idx];
  const total = exam.questions.length;
  const answered = Object.keys(answers).length;

  const submit = useCallback(async () => {
    if (submitting) return;
    setSubmitting(true);
    clearTimeout(saveTimer.current);
    try {
      const r = await api.post(`/api/exams/${exam.course_id}/${exam.id}/submit`, { answers: answersRef.current });
      refresh();
      onDone(r);
      window.scrollTo(0, 0);
    } catch (e) { toast(e.message, 'error'); setSubmitting(false); }
  }, [exam, onDone, refresh, submitting, toast]);

  // Countdown; auto-submit when time is over.
  useEffect(() => {
    const started = Date.now();
    const initial = exam.remaining_seconds;
    const t = setInterval(() => {
      const left = Math.max(0, initial - Math.round((Date.now() - started) / 1000));
      setRemaining(left);
      if (left <= 0) { clearInterval(t); submit(); }
    }, 1000);
    return () => clearInterval(t);
  }, []); // eslint-disable-line

  const choose = (i) => {
    const next = { ...answers, [idx]: i };
    setAnswers(next);
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => api.put(`/api/exams/${exam.course_id}/${exam.id}/answers`, { answers: next }).catch(() => {}), 800);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (submitAsk || quitAsk) return;
      const n = Number(e.key);
      if (n >= 1 && n <= q.choices.length) choose(n - 1);
      else if (e.key === 'ArrowRight' && idx < total - 1) setIdx(idx + 1);
      else if (e.key === 'ArrowLeft' && idx > 0) setIdx(idx - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const subjects = useMemo(() => {
    const out = [];
    exam.questions.forEach((x, i) => { const last = out[out.length - 1]; if (last && last.unit === x.unit) last.indices.push(i); else out.push({ unit: x.unit, title: x.subject, indices: [i] }); });
    return out;
  }, [exam]);
  const low = remaining < 300;

  return (
    <div className="lesson exam-run">
      <div className="exam-top">
        <button className="quit" onClick={() => setQuitAsk(true)} aria-label="Quitter"><Icon.X /></button>
        <div className="grow">
          <div className="small muted"><b>{q.subject}</b> · question {idx + 1}/{total}</div>
          <div className="progress mt-8" style={{ height: 10 }}><div style={{ width: `${(answered / total) * 100}%`, background: 'var(--blue)' }} /></div>
        </div>
        <span className={'exam-timer' + (low ? ' low' : '')}><Icon.Clock /> {mmss(remaining)}</span>
      </div>

      <div className="exam-subjects">
        {subjects.map((s) => {
          const done = s.indices.filter((i) => answers[i] !== undefined).length;
          const active = s.indices.includes(idx);
          return <button key={s.unit} className={'exam-subject' + (active ? ' active' : '')} onClick={() => setIdx(s.indices[0])} title={s.title}>{s.title}<small>{done}/{s.indices.length}</small></button>;
        })}
      </div>

      <div className="qcm-question">{q.q}</div>
      <div className="options">
        {q.choices.map((c, i) => <button key={i} className={'option' + (answers[idx] === i ? ' selected' : '')} onClick={() => choose(i)}><span className="num">{LETTERS[i]}</span>{c}</button>)}
      </div>
      <div className="row wrap mt-16">
        <button className={'btn btn-sm' + (flags[idx] ? ' btn-blue' : '')} onClick={() => setFlags({ ...flags, [idx]: !flags[idx] })}><Icon.Flag /> {flags[idx] ? 'Marquée' : 'Marquer'}</button>
        <button className="btn btn-sm btn-ghost" onClick={() => setShowGrid((v) => !v)}>{showGrid ? 'Masquer' : 'Voir'} toutes les questions</button>
      </div>
      {showGrid ? (
        <div className="exam-grid mt-12">
          {exam.questions.map((_, i) => <button key={i} className={'cell' + (answers[i] !== undefined ? ' done' : '') + (flags[i] ? ' flag' : '') + (i === idx ? ' cur' : '')} onClick={() => setIdx(i)}>{i + 1}</button>)}
        </div>
      ) : null}

      <div className="lesson-bottom">
        <div className="inner">
          <button className="btn" disabled={idx === 0} onClick={() => setIdx(idx - 1)}><Icon.ChevronLeft /> Précédente</button>
          <span className="muted small hide-mobile">{answered}/{total} répondues{Object.values(flags).filter(Boolean).length ? ` · ${Object.values(flags).filter(Boolean).length} marquée(s)` : ''}</span>
          {idx < total - 1
            ? <button className="btn btn-blue" onClick={() => setIdx(idx + 1)}>Suivante <Icon.ChevronRight /></button>
            : <button className="btn btn-primary" onClick={() => setSubmitAsk(true)}>Terminer</button>}
        </div>
      </div>

      <Modal open={submitAsk} onClose={() => setSubmitAsk(false)} title="Rendre ta copie ?">
        <p className="muted">{answered}/{total} questions répondues{total - answered ? ` : ${total - answered} sans réponse seront comptées fausses` : ''}.</p>
        <div className="modal-actions"><button className="btn" onClick={() => setSubmitAsk(false)}>Continuer</button><button className="btn btn-primary" disabled={submitting} onClick={submit}>Corriger</button></div>
      </Modal>
      <Modal open={quitAsk} onClose={() => setQuitAsk(false)} title="Quitter l'examen ?">
        <p className="muted">Tes réponses sont enregistrées : tu peux reprendre tant que le temps n'est pas écoulé (le chronomètre continue). Tu peux aussi abandonner l'examen.</p>
        <div className="modal-actions">
          <button className="btn" onClick={() => setQuitAsk(false)}>Rester</button>
          <button className="btn btn-danger" onClick={async () => { await api.del(`/api/exams/${exam.course_id}/${exam.id}`).catch(() => {}); navigate('/exam'); }}>Abandonner</button>
          <button className="btn btn-blue" onClick={() => navigate('/exam')}>Reprendre plus tard</button>
        </div>
      </Modal>
    </div>
  );
}

function ExamResults({ exam }) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState('wrong');
  const pct = Math.round((exam.correct / exam.total) * 100);
  const list = exam.questions.filter((q) => filter === 'all' || !q.correct);
  return (
    <div className="lesson exam-results">
      <div className="row mb-16"><button className="btn btn-ghost btn-sm" onClick={() => navigate('/exam')}><Icon.Back /> Examens</button></div>
      <div className={'exam-verdict ' + (exam.passed ? 'ok' : 'ko')}>
        <div className="big">{exam.passed ? '🎓' : '📚'}</div>
        <div>
          <h1>{exam.passed ? 'Examen réussi !' : 'Pas encore…'}</h1>
          <p>{exam.correct}/{exam.total} bonnes réponses ({pct} %) en {mmss(exam.duration_seconds)}. {exam.passed ? `Toutes les matières dépassent ${exam.pass_percent} %.` : `Il faut au moins ${exam.pass_percent} % dans chaque matière.`}{exam.xp ? ` +${exam.xp} XP` : ''}</p>
        </div>
      </div>

      <div className="subject-results">
        {exam.subjects.map((s) => (
          <div key={s.unit} className="subject-result">
            <div className="row"><b className="grow">{s.title}</b><span className={'chip ' + (s.passed ? 'chip-green' : 'chip-red')}>{s.percent} %</span></div>
            <div className="bar"><div style={{ width: `${s.percent}%`, background: s.passed ? 'var(--green)' : 'var(--red)' }} /><i style={{ left: `${exam.pass_percent}%` }} /></div>
            <div className="muted small">{s.correct}/{s.total}</div>
          </div>
        ))}
      </div>

      <div className="section-head mt-16"><h2>Corrigé</h2>
        <div className="row"><button className={'chip' + (filter === 'wrong' ? ' chip-red' : '')} onClick={() => setFilter('wrong')}>Erreurs ({exam.questions.filter((q) => !q.correct).length})</button><button className={'chip' + (filter === 'all' ? ' chip-blue' : '')} onClick={() => setFilter('all')}>Tout ({exam.total})</button></div>
      </div>
      {list.length === 0 ? <p className="muted">Aucune erreur, bravo !</p> : (
        <div className="list">
          {list.map((q) => (
            <div key={q.index} className={'qa-card ' + (q.correct ? 'good' : 'bad')}>
              <div className="muted small mb-8">{q.subject} · question {q.index + 1}</div>
              <div className="qa-q">{q.q}</div>
              <ol className="qa-choices">
                {q.choices.map((c, i) => <li key={i} className={(i === q.answer ? 'right' : '') + (i === q.given && !q.correct ? ' given' : '')}><b>{LETTERS[i]}</b> {c}{i === q.given ? <em> · ta réponse</em> : null}</li>)}
              </ol>
              {q.given === null ? <div className="muted small">Sans réponse</div> : null}
              {q.explanation ? <div className="qa-expl">💡 {q.explanation}</div> : null}
              {q.skill_id ? <Link to={`/skill/${exam.course_id}/${q.skill_id}`} className="link-btn small">Revoir la fiche</Link> : null}
            </div>
          ))}
        </div>
      )}
      <div className="row wrap mt-16"><button className="btn btn-primary" onClick={() => navigate('/exam')}>Retour aux examens</button><Link to="/practice" className="btn">Réviser mes erreurs</Link></div>
    </div>
  );
}
