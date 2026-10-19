import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useStatus } from '../lib/status.jsx';
import { Icon } from '../components/Icons.jsx';
import { Modal } from '../components/Modal.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';
import { checkAnswer, normalize, speak, canSpeak } from '../lib/format.js';

function Choose({ ex, value, onChange, result, tts }) {
  useEffect(() => { if (ex.speak) speak(ex.speak, tts); }, [ex, tts]);
  return (
    <>
      <h2>{ex.prompt}</h2>
      <div className="term-box">{ex.emoji ? <span className="emoji-big">{ex.emoji}</span> : null}{ex.speak ? <button className="speak-btn" onClick={() => speak(ex.speak, tts)} aria-label="Écouter"><Icon.Speaker /></button> : null}<div className="bubble">{ex.term}</div></div>
      <div className="options">
        {ex.options.map((o, i) => {
          const cls = 'option' + (result ? (o === ex.answer ? ' correct' : o === value ? ' wrong' : '') : o === value ? ' selected' : '');
          return <button key={o} className={cls} onClick={() => !result && onChange(o)} disabled={!!result}><span className="num">{i + 1}</span>{o}</button>;
        })}
      </div>
    </>
  );
}

function Type({ ex, value, onChange, result, tts, onSubmit }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); if (ex.speak) speak(ex.speak, tts); }, [ex, tts]);
  return (
    <>
      <h2>{ex.prompt}</h2>
      <div className="term-box">{ex.emoji ? <span className="emoji-big">{ex.emoji}</span> : null}{ex.speak ? <button className="speak-btn" onClick={() => speak(ex.speak, tts)} aria-label="Écouter"><Icon.Speaker /></button> : null}<div className="bubble">{ex.term}</div></div>
      <input ref={ref} className="type-input" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={!!result} placeholder="Écris ta réponse…" autoCapitalize="off" autoCorrect="off" spellCheck={false} onKeyDown={(e) => { if (e.key === 'Enter' && value) onSubmit(); }} />
    </>
  );
}

function Listen({ ex, value, onChange, result, tts, onSubmit }) {
  const ref = useRef(null);
  useEffect(() => { ref.current?.focus(); speak(ex.speak, tts); }, [ex, tts]);
  return (
    <>
      <h2>{ex.prompt}</h2>
      <button className="speak-btn big" onClick={() => speak(ex.speak, tts)} aria-label="Écouter"><Icon.Speaker /></button>
      <input ref={ref} className="type-input" value={value || ''} onChange={(e) => onChange(e.target.value)} disabled={!!result} placeholder="Écris ce que tu entends" autoCapitalize="off" autoCorrect="off" spellCheck={false} onKeyDown={(e) => { if (e.key === 'Enter' && value) onSubmit(); }} />
      {!canSpeak() ? <p className="muted small mt-8">Ton navigateur ne sait pas lire à voix haute : la réponse est « {ex.answer} » ({ex.hint}).</p> : null}
    </>
  );
}

function Match({ ex, onComplete, onMistake, tts }) {
  const left = useMemo(() => [...ex.pairs].sort(() => Math.random() - 0.5), [ex]);
  const right = useMemo(() => [...ex.pairs].sort(() => Math.random() - 0.5), [ex]);
  const [selA, setSelA] = useState(null);
  const [selB, setSelB] = useState(null);
  const [done, setDone] = useState([]);
  const [wrong, setWrong] = useState(null);
  useEffect(() => {
    if (selA && selB) {
      const ok = ex.pairs.some((p) => p.a === selA && p.b === selB);
      if (ok) { const d = [...done, selA]; setDone(d); setSelA(null); setSelB(null); if (d.length === ex.pairs.length) onComplete(); }
      else { setWrong([selA, selB]); onMistake(selA); setTimeout(() => { setWrong(null); setSelA(null); setSelB(null); }, 500); }
    }
  }, [selA, selB]); // eslint-disable-line
  const isDone = (a) => done.includes(a);
  return (
    <>
      <h2>{ex.prompt}</h2>
      <div className="match-grid">
        <div className="match-col">{left.map((p) => <button key={p.a} className={'match-btn' + (isDone(p.a) ? ' done' : selA === p.a ? ' selected' : '') + (wrong?.[0] === p.a ? ' wrong' : '')} onClick={() => { setSelA(p.a); speak(p.a, tts); }}>{p.a}</button>)}</div>
        <div className="match-col">{right.map((p) => <button key={p.b} className={'match-btn' + (isDone(ex.pairs.find((x) => x.b === p.b).a) ? ' done' : selB === p.b ? ' selected' : '') + (wrong?.[1] === p.b ? ' wrong' : '')} onClick={() => setSelB(p.b)}>{p.b}</button>)}</div>
      </div>
    </>
  );
}

function Arrange({ ex, value, onChange, result, tts }) {
  const chosen = value || [];
  useEffect(() => { if (ex.speak) speak(ex.speak, tts); }, [ex, tts]);
  const bank = ex.bank.map((w, i) => ({ w, i }));
  return (
    <>
      <h2>{ex.prompt}</h2>
      <div className="term-box">{ex.speak ? <button className="speak-btn" onClick={() => speak(ex.speak, tts)} aria-label="Écouter"><Icon.Speaker /></button> : null}<div className="bubble">{ex.term}</div></div>
      <div className="arrange-answer">{chosen.map((i) => <button key={i} className="word" onClick={() => !result && onChange(chosen.filter((x) => x !== i))}>{ex.bank[i]}</button>)}</div>
      <div className="word-bank">{bank.map(({ w, i }) => <button key={i} className={'word' + (chosen.includes(i) ? ' used' : '')} onClick={() => !result && !chosen.includes(i) && onChange([...chosen, i])}>{w}</button>)}</div>
    </>
  );
}

function Fill({ ex, value, onChange, result }) {
  const parts = ex.term.split('____');
  return (
    <>
      <h2>{ex.prompt}</h2>
      <div className="fill-sentence">{parts[0]}<span className="blank">{value || ' '}</span>{parts[1]}</div>
      <p className="muted mb-16">{ex.hint}</p>
      <div className="options two">{ex.options.map((o) => <button key={o} className={'option' + (result ? (o === ex.answer ? ' correct' : o === value ? ' wrong' : '') : o === value ? ' selected' : '')} onClick={() => !result && onChange(o)} disabled={!!result}>{o}</button>)}</div>
    </>
  );
}

export function Lesson() {
  const { courseId, skillId } = useParams();
  const [params] = useSearchParams();
  const practice = params.get('practice') === '1';
  const navigate = useNavigate();
  const { user } = useAuth();
  const { refresh } = useStatus();
  const [lesson, setLesson] = useState(null);
  const [error, setError] = useState(null);
  const [idx, setIdx] = useState(0);
  const [value, setValue] = useState(null);
  const [result, setResult] = useState(null);
  const [hearts, setHearts] = useState(null);
  const [correct, setCorrect] = useState(0);
  const [mistakes, setMistakes] = useState([]);
  const [queue, setQueue] = useState([]);
  const [quit, setQuit] = useState(false);
  const [end, setEnd] = useState(null);
  const [outOfHearts, setOutOfHearts] = useState(false);
  const startedAt = useRef(Date.now());

  useEffect(() => {
    (async () => {
      try {
        const data = skillId === '_mixed' ? await api.post(`/api/courses/${courseId}/practice`) : await api.post(`/api/courses/${courseId}/skills/${skillId}/lesson`, { practice });
        setLesson(data);
        setQueue(data.exercises);
        setHearts(data.hearts);
      } catch (e) { setError(e); }
    })();
  }, [courseId, skillId, practice]);

  const ex = queue[idx];
  const total = lesson ? lesson.exercises.length : 0;
  const answered = idx;
  const tts = lesson?.tts_lang || 'en-US';

  const finish = useCallback(async (finalCorrect, finalMistakes) => {
    const sid = lesson.skill_id;
    try {
      const r = await api.post(`/api/courses/${courseId}/skills/${sid}/complete`, { correct: finalCorrect, total, practice: lesson.practice, level: lesson.level, mistakes: finalMistakes, perfect: finalMistakes.length === 0 });
      setEnd(r);
      refresh();
    } catch (e) { setError(e); }
  }, [lesson, courseId, total, refresh]);

  const next = () => {
    setValue(null); setResult(null);
    if (idx + 1 >= queue.length) { finish(correct, mistakes); return; }
    setIdx(idx + 1);
  };

  const submit = async () => {
    if (!ex || result) return;
    let ok, close = false, given = value;
    if (ex.type === 'choose' || ex.type === 'fill') ok = value === ex.answer;
    else if (ex.type === 'arrange') { given = (value || []).map((i) => ex.bank[i]).join(' '); const r = checkAnswer(given, ex.accept); ok = r.ok; close = r.close; }
    else { const r = checkAnswer(value, ex.accept); ok = r.ok; close = r.close; }
    if (ex.speakAnswer && ok) speak(ex.answer, tts);
    setResult({ ok, close });
    if (ok) setCorrect((c) => c + 1);
    else {
      const term = ex.type === 'arrange' ? ex.answer : ex.term || ex.answer;
      setMistakes((m) => [...m, term]);
      // Re-queue the exercise at the end (Duolingo style), once.
      if (!ex._retry) setQueue((q) => [...q, { ...ex, id: ex.id + 100, _retry: true }]);
      if (!lesson.practice) {
        try { const h = await api.post(`/api/courses/${courseId}/hearts/lose`); setHearts(h); if (h.hearts <= 0) setOutOfHearts(true); } catch {}
      }
    }
  };

  const onMatchComplete = () => { setResult({ ok: true }); setCorrect((c) => c + 1); };
  const onMatchMistake = (term) => { setMistakes((m) => (m.includes(term) ? m : [...m, term])); };

  if (error) return <div className="lesson"><ErrorBox error={error} /><button className="btn mt-16" onClick={() => navigate('/')}>Retour</button></div>;
  if (!lesson) return <div className="lesson"><Spinner /></div>;

  if (end) {
    const acc = total ? Math.round((end.passed ? Math.max(correct, 1) : correct) / total * 100) : 0;
    return (
      <div className="lesson">
        <div className="lesson-end">
          <div className="big-emoji">{end.passed ? (mistakes.length === 0 ? '🏆' : '🎉') : '😅'}</div>
          <h1>{end.passed ? (mistakes.length === 0 ? 'Leçon parfaite !' : 'Leçon terminée !') : 'Presque…'}</h1>
          <p className="muted">{end.completed_skill ? 'Tu maîtrises cette leçon. Une couronne de plus !' : end.leveled_up ? `Niveau ${end.level_after} atteint sur cette leçon.` : end.passed ? 'Continue comme ça.' : 'Il faut 60 % de bonnes réponses pour valider. Réessaie !'}</p>
          <div className="end-cards">
            <div className="end-card xp"><div className="cap">XP gagnés</div><div className="val">⚡ {end.xp}</div></div>
            <div className="end-card acc"><div className="cap">Précision</div><div className="val">🎯 {Math.min(100, Math.round((correct / Math.max(1, correct + mistakes.length)) * 100))} %</div></div>
            <div className="end-card streak"><div className="cap">Série</div><div className="val">🔥 {end.streak.current}</div></div>
          </div>
          {end.goal_reached ? <div className="chip chip-yellow" style={{ fontSize: 14 }}>✅ Objectif du jour atteint !</div> : <div className="muted small">{end.xp_today}/{end.daily_goal} XP aujourd'hui</div>}
          <div className="row wrap mt-16"><button className="btn btn-primary" onClick={() => navigate('/')}>Continuer</button>{!end.passed ? <button className="btn" onClick={() => window.location.reload()}>Réessayer</button> : null}</div>
        </div>
      </div>
    );
  }

  const canCheck = ex && (ex.type === 'match' ? false : ex.type === 'arrange' ? (value || []).length > 0 : !!value);
  const Comp = { choose: Choose, type: Type, listen: Listen, arrange: Arrange, fill: Fill }[ex?.type];

  return (
    <div className="lesson">
      <div className="lesson-top">
        <button className="quit" onClick={() => setQuit(true)} aria-label="Quitter"><Icon.X /></button>
        <div className="progress"><div style={{ width: `${(answered / Math.max(1, queue.length)) * 100}%` }} /></div>
        {!lesson.practice && hearts ? <span className="hearts"><Icon.Heart /> {hearts.hearts}</span> : <span className="chip chip-blue">Révision</span>}
      </div>
      {ex?.type === 'match' ? <Match key={ex.id} ex={ex} onComplete={onMatchComplete} onMistake={onMatchMistake} tts={tts} /> : ex && Comp ? <Comp key={ex.id} ex={ex} value={value} onChange={setValue} result={result} tts={tts} onSubmit={submit} /> : null}
      <div className={'lesson-bottom' + (result ? (result.ok ? ' correct' : ' wrong') : '')}>
        <div className="inner">
          {result ? (
            <div className={'feedback ' + (result.ok ? 'correct' : 'wrong')}>
              <span className="mark">{result.ok ? <Icon.Check color="var(--green)" /> : <Icon.X color="var(--red)" />}</span>
              <div><h3>{result.ok ? (result.close ? 'Presque ! On accepte.' : ['Excellent !', 'Bien joué !', 'Génial !', 'Parfait !'][idx % 4]) : 'Bonne réponse :'}</h3>{!result.ok || result.close ? <p>{ex.answer}</p> : ex.type === 'choose' && ex.hint ? <p>{ex.hint}</p> : null}</div>
            </div>
          ) : <button className="btn btn-ghost" onClick={next} style={{ visibility: ex?.type === 'match' ? 'hidden' : 'visible' }}>Passer</button>}
          {result ? <button className={'btn btn-primary' + (result.ok ? '' : ' wrong')} onClick={next} autoFocus>Continuer</button> : <button className="btn btn-primary" onClick={submit} disabled={!canCheck}>Vérifier</button>}
        </div>
      </div>
      <Modal open={quit} onClose={() => setQuit(false)} title="Quitter la leçon ?">
        <p className="muted">Ta progression dans cette leçon sera perdue.</p>
        <div className="modal-actions"><button className="btn" onClick={() => setQuit(false)}>Continuer la leçon</button><button className="btn btn-danger" onClick={() => navigate('/')}>Quitter</button></div>
      </Modal>
      <Modal open={outOfHearts} onClose={() => {}} title="Plus de cœurs 💔">
        <p className="muted">Fais une séance de révision pour récupérer un cœur, ou attends : un cœur revient toutes les 4 heures.</p>
        <div className="modal-actions"><button className="btn" onClick={() => navigate('/')}>Retour</button><button className="btn btn-blue" onClick={() => navigate(`/lesson/${courseId}/_mixed?practice=1`, { replace: true })}>Réviser</button></div>
      </Modal>
    </div>
  );
}
