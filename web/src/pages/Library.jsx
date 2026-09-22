import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { MediaCard } from '../components/MediaCard.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';
import { relativeDay, STATUS_LABELS } from '../lib/format.js';

const TABS = [
  { key: 'all', label: 'Toutes' },
  { key: 'watching', label: 'En cours' },
  { key: 'up_to_date', label: 'À jour' },
  { key: 'not_started', label: 'Pas commencées' },
  { key: 'for_later', label: 'Pour plus tard' },
  { key: 'stopped', label: 'Arrêtées' },
  { key: 'favorites', label: 'Favoris' },
];
const MOVIE_TABS = [
  { key: 'watchlist', label: 'À voir' },
  { key: 'watched', label: 'Vus' },
  { key: 'favorites', label: 'Favoris' },
];

export function Library() {
  const [params, setParams] = useSearchParams();
  const kind = params.get('kind') === 'movies' ? 'movies' : 'shows';
  const tab = params.get('tab') || (kind === 'movies' ? 'watchlist' : 'all');
  const sort = params.get('sort') || 'recent';
  const [shows, setShows] = useState(null);
  const [movies, setMovies] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    let c = false;
    setError(null);
    if (kind === 'shows') api.get('/api/library').then((d) => !c && setShows(d)).catch((e) => !c && setError(e));
    else api.get('/api/movies').then((d) => !c && setMovies(d)).catch((e) => !c && setError(e));
    return () => { c = true; };
  }, [kind]);

  const set = (patch) => setParams({ kind, tab, sort, ...patch }, { replace: true });

  const counts = useMemo(() => {
    const c = { all: shows?.length || 0, favorites: 0 };
    for (const s of shows || []) { c[s.status] = (c[s.status] || 0) + 1; if (s.favorite) c.favorites++; }
    return c;
  }, [shows]);
  const movieCounts = useMemo(() => {
    const c = { watchlist: 0, watched: 0, favorites: 0 };
    for (const m of movies || []) { c[m.status] = (c[m.status] || 0) + 1; if (m.favorite) c.favorites++; }
    return c;
  }, [movies]);

  const list = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (kind === 'shows') {
      let l = (shows || []).filter((s) => tab === 'all' || (tab === 'favorites' ? s.favorite : s.status === tab));
      if (q) l = l.filter((s) => s.name.toLowerCase().includes(q));
      const sorters = {
        recent: (a, b) => (b.last_watched_at || b.added_at || '').localeCompare(a.last_watched_at || a.added_at || ''),
        name: (a, b) => a.name.localeCompare(b.name, 'fr'),
        added: (a, b) => (b.added_at || '').localeCompare(a.added_at || ''),
        remaining: (a, b) => b.remaining_count - a.remaining_count,
      };
      return l.sort(sorters[sort] || sorters.recent);
    }
    let l = (movies || []).filter((m) => (tab === 'favorites' ? m.favorite : m.status === tab));
    if (q) l = l.filter((m) => m.title.toLowerCase().includes(q));
    return l.sort(sort === 'name' ? (a, b) => a.title.localeCompare(b.title, 'fr') : (a, b) => (b.watched_at || b.added_at || '').localeCompare(a.watched_at || a.added_at || ''));
  }, [shows, movies, kind, tab, sort, filter]);

  const loading = kind === 'shows' ? !shows : !movies;
  const tabs = kind === 'shows' ? TABS : MOVIE_TABS;
  const cnt = kind === 'shows' ? counts : movieCounts;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Ma liste</h1><p>{kind === 'shows' ? `${counts.all} série${counts.all > 1 ? 's' : ''} suivie${counts.all > 1 ? 's' : ''}` : `${movieCounts.watched} film${movieCounts.watched > 1 ? 's' : ''} vu${movieCounts.watched > 1 ? 's' : ''}`}</p></div>
        <div className="tabs">
          <button className={'tab' + (kind === 'shows' ? ' active' : '')} onClick={() => setParams({ kind: 'shows', tab: 'all' }, { replace: true })}>Séries</button>
          <button className={'tab' + (kind === 'movies' ? ' active' : '')} onClick={() => setParams({ kind: 'movies', tab: 'watchlist' }, { replace: true })}>Films</button>
        </div>
      </div>

      <div className="row wrap mb-16" style={{ gap: 12 }}>
        <div className="tabs grow">
          {tabs.map((t) => (
            <button key={t.key} className={'tab' + (tab === t.key ? ' active' : '')} onClick={() => set({ tab: t.key })}>{t.label}<span className="count">{cnt[t.key] || 0}</span></button>
          ))}
        </div>
        <select className="input" style={{ width: 'auto' }} value={sort} onChange={(e) => set({ sort: e.target.value })}>
          <option value="recent">Activité récente</option>
          <option value="name">Nom</option>
          <option value="added">Date d'ajout</option>
          {kind === 'shows' ? <option value="remaining">Épisodes restants</option> : null}
        </select>
        <input className="input" style={{ width: 200 }} placeholder="Filtrer…" value={filter} onChange={(e) => setFilter(e.target.value)} />
      </div>

      {error ? <ErrorBox error={error} /> : loading ? <Spinner /> : list.length === 0 ? (
        <Empty icon={kind === 'shows' ? '📺' : '🎬'} title="Rien ici pour le moment" text={kind === 'shows' ? 'Ajoutez des séries depuis Explorer.' : 'Ajoutez des films depuis Explorer.'} action="Explorer" to={kind === 'shows' ? '/explore' : '/explore?type=movie'} />
      ) : (
        <div className="grid">
          {list.map((item) => kind === 'shows' ? (
            <MediaCard key={item.id} item={{ ...item, type: 'tv', followed: false }}
              sub={item.status === 'watching' ? `${item.remaining_count} à voir` : item.status === 'up_to_date' && item.upcoming_episode?.air_date ? `Prochain : ${relativeDay(item.upcoming_episode.air_date)}` : STATUS_LABELS[item.status]} />
          ) : (
            <MediaCard key={item.id} item={{ ...item, type: 'movie', name: item.title, date: item.release_date, followed: item.status === 'watched' }}
              sub={item.status === 'watched' ? `Vu · ${item.rating ? item.rating + '/10' : ''}` : item.release_date?.slice(0, 4)} />
          ))}
        </div>
      )}
    </div>
  );
}
