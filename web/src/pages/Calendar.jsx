import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { Icon } from '../components/Icons.jsx';
import { Poster } from '../components/Poster.jsx';
import { SafeImg } from '../components/SafeImg.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { addDays, epCode, fmtDate, img, todayStr } from '../lib/format.js';
import { useToast } from '../lib/toast.jsx';

const DOW = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const monthName = new Intl.DateTimeFormat('fr-FR', { month: 'long', year: 'numeric' });

function monthRange(y, m) {
  const first = new Date(y, m, 1);
  const last = new Date(y, m + 1, 0);
  const startOffset = (first.getDay() + 6) % 7;
  const start = addDays(`${y}-${String(m + 1).padStart(2, '0')}-01`, -startOffset);
  const lastStr = `${y}-${String(m + 1).padStart(2, '0')}-${String(last.getDate()).padStart(2, '0')}`;
  const endOffset = (7 - ((last.getDay() + 6) % 7) - 1) % 7;
  const end = addDays(lastStr, endOffset);
  return { start, end };
}

export function Calendar() {
  const today = todayStr();
  const [view, setView] = useState('agenda');
  const [cursor, setCursor] = useState({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) - 1 });
  const [range, setRange] = useState({ from: addDays(today, -7), to: addDays(today, 30) });
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(today);
  const toast = useToast();

  const effectiveRange = view === 'month' ? monthRange(cursor.y, cursor.m) : null;
  const from = view === 'month' ? effectiveRange.start : range.from;
  const to = view === 'month' ? effectiveRange.end : range.to;

  const load = () => {
    setError(null);
    api.get(`/api/library/calendar?from=${from}&to=${to}`).then(setData).catch(setError);
  };
  useEffect(load, [from, to]); // eslint-disable-line

  const byDay = useMemo(() => {
    const m = new Map();
    for (const e of data?.episodes || []) {
      if (!m.has(e.air_date)) m.set(e.air_date, []);
      m.get(e.air_date).push(e);
    }
    return m;
  }, [data]);

  const toggleWatched = async (ep) => {
    try {
      if (ep.watched) await api.del(`/api/shows/${ep.show_id}/episodes/${ep.id}/watch`);
      else await api.post(`/api/shows/${ep.show_id}/episodes/${ep.id}/watch`);
      setData((d) => ({ ...d, episodes: d.episodes.map((e) => (e.id === ep.id ? { ...e, watched: !e.watched } : e)) }));
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  const days = useMemo(() => {
    const out = [];
    let d = from;
    while (d <= to) { out.push(d); d = addDays(d, 1); }
    return out;
  }, [from, to]);

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Calendrier</h1><p>Les prochains épisodes de vos séries.</p></div>
        <div className="tabs">
          <button className={'tab' + (view === 'agenda' ? ' active' : '')} onClick={() => setView('agenda')}>Agenda</button>
          <button className={'tab' + (view === 'month' ? ' active' : '')} onClick={() => setView('month')}>Mois</button>
        </div>
      </div>

      {error ? <ErrorBox error={error} onRetry={load} /> : null}

      {view === 'agenda' ? (
        <>
          <div className="cal-nav mb-16">
            <button className="btn btn-sm" onClick={() => setRange((r) => ({ from: addDays(r.from, -30), to: r.to }))}><Icon.ChevronLeft /> Plus tôt</button>
            <span className="muted small grow">Du {fmtDate(from, 'short')} au {fmtDate(to, 'short')}</span>
            <button className="btn btn-sm" onClick={() => setRange((r) => ({ from: r.from, to: addDays(r.to, 30) }))}>Plus tard <Icon.ChevronRight /></button>
          </div>
          {!data ? <Spinner /> : byDay.size === 0 ? (
            <Empty icon="📅" title="Rien de prévu" text="Aucun épisode sur cette période pour les séries que vous suivez." />
          ) : (
            [...byDay.keys()].sort().map((day) => (
              <div key={day} className="cal-day">
                <div className="cal-day-head">
                  <span className={'d' + (day === today ? ' today' : '')}>{day === today ? "Aujourd'hui" : fmtDate(day, 'long')}</span>
                  <span className="n">{byDay.get(day).length} épisode{byDay.get(day).length > 1 ? 's' : ''}</span>
                </div>
                <div className="cal-list">
                  {byDay.get(day).map((ep) => <CalItem key={ep.id} ep={ep} today={today} onToggle={toggleWatched} />)}
                </div>
              </div>
            ))
          )}
        </>
      ) : (
        <>
          <div className="cal-nav mb-16">
            <button className="btn btn-icon btn-sm" onClick={() => setCursor((c) => (c.m === 0 ? { y: c.y - 1, m: 11 } : { y: c.y, m: c.m - 1 }))} aria-label="Mois précédent"><Icon.ChevronLeft /></button>
            <h2 className="grow" style={{ textAlign: 'center', textTransform: 'capitalize' }}>{monthName.format(new Date(cursor.y, cursor.m, 1))}</h2>
            <button className="btn btn-icon btn-sm" onClick={() => setCursor((c) => (c.m === 11 ? { y: c.y + 1, m: 0 } : { y: c.y, m: c.m + 1 }))} aria-label="Mois suivant"><Icon.ChevronRight /></button>
          </div>
          {!data ? <Spinner /> : (
            <>
              <div className="month-grid">
                {DOW.map((d) => <div key={d} className="dow">{d}</div>)}
                {days.map((d) => {
                  const eps = byDay.get(d) || [];
                  const inMonth = Number(d.slice(5, 7)) - 1 === cursor.m;
                  return (
                    <div key={d} className={'cell' + (inMonth ? '' : ' out') + (d === today ? ' today' : '') + (d === selected ? ' selected' : '')} onClick={() => setSelected(d)}>
                      <span className="num">{Number(d.slice(8, 10))}</span>
                      <div className="dots">
                        {eps.slice(0, 3).map((e) => <span key={e.id} className="dot" title={`${e.show_name} ${epCode(e)}`}>{e.show_poster ? <SafeImg src={img(e.show_poster, 'w92')} /> : null}</span>)}
                        {eps.length > 3 ? <span className="more">+{eps.length - 3}</span> : null}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="cal-day mt-24">
                <div className="cal-day-head"><span className={'d' + (selected === today ? ' today' : '')}>{fmtDate(selected, 'long')}</span></div>
                {(byDay.get(selected) || []).length === 0 ? <p className="muted">Aucun épisode ce jour-là.</p> : (
                  <div className="cal-list">{byDay.get(selected).map((ep) => <CalItem key={ep.id} ep={ep} today={today} onToggle={toggleWatched} />)}</div>
                )}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function CalItem({ ep, today, onToggle }) {
  const future = ep.air_date > today;
  return (
    <div className="cal-item">
      <Link to={`/show/${ep.show_id}`} className="poster" style={{ width: 44 }}>{ep.show_poster ? <SafeImg src={img(ep.show_poster, 'w92')} loading="lazy" /> : null}</Link>
      <Link to={`/show/${ep.show_id}`} className="info">
        <div className="show ellipsis">{ep.show_name}</div>
        <div className="ep ellipsis"><b>{epCode(ep)}</b>{ep.name || 'Titre à venir'}</div>
      </Link>
      {future ? <span className="chip">À venir</span> : (
        <button className={'check-btn sm' + (ep.watched ? ' done' : '')} onClick={() => onToggle(ep)} aria-label={ep.watched ? 'Vu' : 'Marquer comme vu'}><Icon.Check /></button>
      )}
    </div>
  );
}
