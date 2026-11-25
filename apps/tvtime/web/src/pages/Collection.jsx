import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Poster } from '../components/Poster.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';
import { STATUS_LABELS } from '../lib/format.js';

export function Collection() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const order = params.get('order') === 'release' ? 'release' : 'chronological';
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [hideOptional, setHideOptional] = useState(false);
  const [busyKey, setBusyKey] = useState(null);
  const timer = useRef(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      const d = await api.get(`/api/collections/${id}?order=${order}`);
      setData(d);
      return d;
    } catch (e) {
      setError(e);
      return null;
    }
  }, [id, order]);

  useEffect(() => { setData(null); load(); }, [load]);

  // Poll while the server is still resolving entries on TMDB.
  useEffect(() => {
    clearTimeout(timer.current);
    if (data && data.pending > 0 && data.has_api_key) {
      timer.current = setTimeout(load, 2500);
    }
    return () => clearTimeout(timer.current);
  }, [data, load]);

  const setOrder = (o) => setParams({ order: o }, { replace: true });

  const act = async (item, fn, msg) => {
    if (busyKey) return;
    setBusyKey(item.key);
    try {
      await fn();
      await load();
      if (msg) toast(msg, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusyKey(null);
    }
  };

  const toggleMovie = (item) => {
    const watched = item.user?.status === 'watched';
    return act(item, () => (watched ? api.post(`/api/movies/${item.tmdb_id}/watchlist`) : api.post(`/api/movies/${item.tmdb_id}/watched`)), watched ? null : `${item.title} marqué comme vu`);
  };
  const followShow = (item) => act(item, () => api.post(`/api/shows/${item.tmdb_id}/follow`), `${item.title} ajoutée à votre liste`);
  const watchAllShow = (item) => act(item, () => api.post(`/api/shows/${item.tmdb_id}/watch-all`), `${item.title} marquée comme vue`);
  const retry = () => act({ key: '__retry' }, () => api.post(`/api/collections/${id}/resolve`), 'Recherche relancée');

  const groups = useMemo(() => {
    if (!data) return [];
    const out = [];
    for (const it of data.items) {
      if (hideOptional && it.optional) continue;
      const g = it.group || '';
      const last = out[out.length - 1];
      if (last && last.label === g) last.items.push(it);
      else out.push({ label: g, items: [it] });
    }
    return out;
  }, [data, hideOptional]);

  if (error) return <div className="page"><button className="btn btn-ghost mb-16" onClick={() => navigate(-1)}><Icon.Back /> Retour</button><ErrorBox error={error} onRetry={load} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;

  const optionalCount = data.items.filter((i) => i.optional).length;

  return (
    <div className="page">
      <div className="row mb-12">
        <button className="btn btn-ghost btn-sm" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/collections'))}><Icon.Back /> Collections</button>
      </div>
      <div className="coll-head">
        <div className="coll-head-icon">{data.icon}</div>
        <div className="grow">
          <h1>{data.name}</h1>
          <p className="muted">{data.description}</p>
          <div className="row wrap mt-12">
            <span className="chip">{data.category_label}</span>
            <span className="chip chip-accent">{data.done_count}/{data.item_count} vus</span>
            {data.pending > 0 ? <span className="chip chip-blue">Recherche TMDB… {data.item_count - data.pending}/{data.item_count}</span> : null}
            {data.not_found > 0 ? <span className="chip chip-red">{data.not_found} introuvable{data.not_found > 1 ? 's' : ''}</span> : null}
          </div>
          <div className="progress mt-12"><div style={{ width: `${data.percent}%` }} /></div>
        </div>
      </div>

      {!data.has_api_key ? (
        <div className="card card-pad mb-16 row wrap">
          <span className="grow">⚠️ Clé API TMDB manquante : impossible de charger les affiches et de suivre les titres.</span>
          {user.is_admin ? <Link to="/settings" className="btn btn-sm">Configurer</Link> : null}
        </div>
      ) : null}

      <div className="row wrap mb-16" style={{ gap: 10 }}>
        {data.has_distinct_orders ? (
          <div className="tabs">
            <button className={'tab' + (order === 'chronological' ? ' active' : '')} onClick={() => setOrder('chronological')}>Ordre chronologique</button>
            <button className={'tab' + (order === 'release' ? ' active' : '')} onClick={() => setOrder('release')}>Ordre de sortie</button>
          </div>
        ) : null}
        {optionalCount > 0 ? (
          <label className="row small muted" style={{ cursor: 'pointer' }}>
            <input type="checkbox" checked={hideOptional} onChange={(e) => setHideOptional(e.target.checked)} /> Masquer les optionnels ({optionalCount})
          </label>
        ) : null}
        <span className="grow" />
        {data.not_found > 0 && data.has_api_key ? <button className="btn btn-sm btn-ghost" onClick={retry} disabled={!!busyKey}><Icon.Refresh /> Relancer la recherche</button> : null}
      </div>

      {groups.map((g, gi) => (
        <section key={gi} className="coll-group">
          {g.label ? <h3 className="coll-group-title">{g.label}</h3> : null}
          {g.items.map((item) => (
            <CollectionRow key={item.key} item={item} index={order === 'release' ? item.release_order : item.chronological_order}
              busy={busyKey === item.key} onToggleMovie={toggleMovie} onFollow={followShow} onWatchAll={watchAllShow} />
          ))}
        </section>
      ))}
    </div>
  );
}

function CollectionRow({ item, index, busy, onToggleMovie, onFollow, onWatchAll }) {
  const isMovie = item.type === 'movie';
  const media = item.media;
  const to = media ? (isMovie ? `/movie/${item.tmdb_id}` : `/show/${item.tmdb_id}`) : null;
  const done = isMovie ? item.user?.status === 'watched' : !!item.user && item.user.watched_count > 0 && item.user.remaining_count === 0;
  const Wrapper = to ? Link : 'div';
  const wrapperProps = to ? { to } : {};

  return (
    <div className={'coll-row' + (done ? ' done' : '') + (item.optional ? ' optional' : '')}>
      <div className="coll-index">{index}</div>
      <Wrapper {...wrapperProps} className="coll-poster-link">
        <Poster path={media?.poster_path} title={item.title} size="w185" checked={done} percent={!isMovie && item.user ? item.user.percent : undefined} />
      </Wrapper>
      <div className="coll-info">
        <Wrapper {...wrapperProps} className="coll-title">{media ? (isMovie ? media.title : media.name) : item.title}</Wrapper>
        <div className="coll-meta">
          <span className={'chip ' + (isMovie ? 'chip-blue' : 'chip-accent')}>{isMovie ? 'Film' : 'Série'}</span>
          <span className="muted">{item.year}</span>
          {item.optional ? <span className="chip">Optionnel</span> : null}
          {item.resolution === 'pending' ? <span className="muted small">Recherche…</span> : null}
          {item.resolution === 'not_found' ? <span className="chip chip-red">Introuvable sur TMDB</span> : null}
          {!isMovie && item.user ? <span className="muted small">{item.user.watched_count}/{item.user.aired_count} ép. · {STATUS_LABELS[item.user.status]}</span> : null}
          {isMovie && item.user?.status === 'watchlist' ? <span className="muted small">Dans ma liste</span> : null}
        </div>
        {item.note ? <div className="coll-note">{item.note}</div> : null}
      </div>
      <div className="coll-actions">
        {media && isMovie ? (
          <button className={'check-btn' + (done ? ' done' : '')} disabled={busy} title={done ? 'Marquer comme non vu' : 'Marquer comme vu'} onClick={() => onToggleMovie(item)}><Icon.Check /></button>
        ) : null}
        {media && !isMovie ? (
          item.user ? (
            done ? <span className="check-btn done" title="À jour"><Icon.Check /></span>
              : <button className="btn btn-sm" disabled={busy} title="Marquer tous les épisodes diffusés comme vus" onClick={() => onWatchAll(item)}><Icon.Check /> Tout vu</button>
          ) : (
            <button className="btn btn-sm" disabled={busy} onClick={() => onFollow(item)}><Icon.Plus /> Suivre</button>
          )
        ) : null}
      </div>
    </div>
  );
}
