import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { MediaCard } from '../components/MediaCard.jsx';
import { Icon } from '../components/Icons.jsx';
import { Empty, ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';

const SECTIONS = {
  tv: [
    { key: 'trending_tv', title: 'Tendances de la semaine' },
    { key: 'on_the_air', title: 'Diffusées en ce moment' },
    { key: 'popular_tv', title: 'Populaires' },
    { key: 'top_rated_tv', title: 'Les mieux notées' },
  ],
  movie: [
    { key: 'trending_movie', title: 'Tendances de la semaine' },
    { key: 'now_playing', title: 'Au cinéma' },
    { key: 'upcoming_movie', title: 'Prochainement' },
    { key: 'popular_movie', title: 'Populaires' },
    { key: 'top_rated_movie', title: 'Les mieux notés' },
  ],
};

function useDebounced(value, ms) {
  const [v, setV] = useState(value);
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t); }, [value, ms]);
  return v;
}

export function Explore() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') || '';
  const type = params.get('type') === 'movie' ? 'movie' : 'tv';
  const [input, setInput] = useState(q);
  const debounced = useDebounced(input, 350);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (debounced !== q) setParams(debounced ? { q: debounced, type } : { type }, { replace: true });
  }, [debounced]); // eslint-disable-line

  useEffect(() => {
    let cancelled = false;
    if (!q) { setResults(null); return; }
    setLoading(true);
    setError(null);
    api.get(`/api/discover/search?q=${encodeURIComponent(q)}&type=${type}`)
      .then((d) => !cancelled && setResults(d.results))
      .catch((e) => !cancelled && setError(e))
      .finally(() => !cancelled && setLoading(false));
    return () => { cancelled = true; };
  }, [q, type]);

  const setType = (t) => setParams(q ? { q, type: t } : { type: t }, { replace: true });

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Explorer</h1><p>Recherchez une série ou un film à suivre.</p></div>
      </div>
      <div className="searchbar mb-16">
        <Icon.Search />
        <input ref={inputRef} className="input" placeholder={type === 'movie' ? 'Rechercher un film…' : 'Rechercher une série…'} value={input} onChange={(e) => setInput(e.target.value)} autoFocus />
        {input ? <button className="clear" onClick={() => { setInput(''); inputRef.current?.focus(); }} aria-label="Effacer"><Icon.X /></button> : null}
      </div>
      <div className="tabs mb-16">
        <button className={'tab' + (type === 'tv' ? ' active' : '')} onClick={() => setType('tv')}>Séries</button>
        <button className={'tab' + (type === 'movie' ? ' active' : '')} onClick={() => setType('movie')}>Films</button>
      </div>

      {error ? <ErrorBox error={error} /> : null}

      {q ? (
        loading && !results ? <Spinner /> : results && results.length === 0 ? (
          <Empty icon="🔍" title="Aucun résultat" text={`Rien trouvé pour « ${q} ».`} />
        ) : results ? (
          <div className="grid">{results.map((r) => <MediaCard key={`${r.type}-${r.id}`} item={r} />)}</div>
        ) : null
      ) : (
        <>
          {type === 'tv' ? <Recommendations /> : null}
          {SECTIONS[type].map((s) => <DiscoverRow key={s.key} listKey={s.key} title={s.title} />)}
        </>
      )}
    </div>
  );
}

function DiscoverRow({ listKey, title }) {
  const [items, setItems] = useState(null);
  const [error, setError] = useState(null);
  useEffect(() => {
    let c = false;
    api.get(`/api/discover/list/${listKey}`).then((d) => !c && setItems(d.results)).catch((e) => !c && setError(e));
    return () => { c = true; };
  }, [listKey]);
  if (error) return <section className="section"><SectionHead title={title} /><ErrorBox error={error} /></section>;
  return (
    <section className="section">
      <SectionHead title={title} />
      {!items ? <Spinner /> : <div className="hscroll">{items.map((r) => <MediaCard key={r.id} item={r} />)}</div>}
    </section>
  );
}

function Recommendations() {
  const [items, setItems] = useState(null);
  useEffect(() => {
    let c = false;
    api.get('/api/discover/recommendations').then((d) => !c && setItems(d.results)).catch(() => !c && setItems([]));
    return () => { c = true; };
  }, []);
  if (!items || !items.length) return null;
  return (
    <section className="section">
      <SectionHead title="Recommandé pour vous" />
      <div className="hscroll">{items.map((r) => <MediaCard key={r.id} item={r} />)}</div>
    </section>
  );
}
