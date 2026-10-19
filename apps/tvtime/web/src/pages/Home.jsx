import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { WatchNextCard } from '../components/WatchNextCard.jsx';
import { MediaCard } from '../components/MediaCard.jsx';
import { Poster } from '../components/Poster.jsx';
import { Empty, ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';
import { durationText, epCode, relativeDay } from '../lib/format.js';

export function Home() {
  const { user, has_api_key } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      setError(null);
      setData(await api.get('/api/library/home'));
    } catch (e) {
      setError(e);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onShowChange = (updated) => {
    // Optimistically refresh the whole home payload; cheap on a household-scale DB.
    load();
  };

  const hour = new Date().getHours();
  const greeting = hour < 5 ? 'Bonne nuit' : hour < 12 ? 'Bonjour' : hour < 18 ? 'Bon après-midi' : 'Bonsoir';

  if (error) return <div className="page"><ErrorBox error={error} onRetry={load} /></div>;
  if (!data) return <div className="page"><Spinner /></div>;

  const empty = data.counts.shows === 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1>{greeting}, {user.display_name} 👋</h1>
          <p>{data.counts.episodes_to_watch > 0 ? `${data.counts.episodes_to_watch} épisode${data.counts.episodes_to_watch > 1 ? 's' : ''} à rattraper` : 'Vous êtes à jour sur toutes vos séries !'}</p>
        </div>
        <Link to="/explore" className="btn btn-primary">+ Ajouter une série</Link>
      </div>

      {!has_api_key && user.is_admin ? (
        <div className="card card-pad mb-16 row wrap">
          <span className="grow">⚠️ Aucune clé API TMDB configurée : la recherche et l'ajout de séries ne fonctionneront pas.</span>
          <Link to="/settings" className="btn btn-sm">Configurer</Link>
        </div>
      ) : null}

      {!empty ? (
        <div className="stats-strip mb-16">
          <div className="stat"><div className="value">{data.counts.shows}</div><div className="label">Séries</div></div>
          <div className="stat"><div className="value">{data.counts.episodes_to_watch}</div><div className="label">À voir</div></div>
          <div className="stat"><div className="value">{durationText(data.counts.minutes)}</div><div className="label">Temps passé</div></div>
        </div>
      ) : null}

      {empty ? (
        <Empty icon="🍿" title="Votre liste est vide" text="Recherchez une série pour commencer à suivre vos épisodes." action="Explorer les séries" to="/explore" />
      ) : null}

      {data.watch_next.length ? (
        <section className="section">
          <SectionHead title="À regarder" count={data.watch_next.length} />
          <div className="wn-grid">
            {data.watch_next.map((s) => <WatchNextCard key={s.id} show={s} onChange={onShowChange} />)}
          </div>
        </section>
      ) : null}

      {data.upcoming.length ? (
        <section className="section">
          <SectionHead title="À venir" to="/calendar" linkText="Calendrier" />
          <div className="hscroll">
            {data.upcoming.map((ep) => (
              <Link key={ep.id} to={`/show/${ep.show_id}`} className="media-card">
                <Poster path={ep.show_poster} title={ep.show_name} size="w185" badge={relativeDay(ep.air_date)} />
                <div className="title clamp-2">{ep.show_name}</div>
                <div className="sub ellipsis">{epCode(ep)} · {ep.name}</div>
              </Link>
            ))}
          </div>
        </section>
      ) : null}

      {data.not_started.length ? (
        <section className="section">
          <SectionHead title="Pas encore commencées" count={data.not_started.length} to="/library?tab=not_started" />
          <div className="hscroll">
            {data.not_started.map((s) => <MediaCard key={s.id} item={{ ...s, type: 'tv' }} sub={`${s.aired_count} épisodes`} />)}
          </div>
        </section>
      ) : null}

      {data.up_to_date.length ? (
        <section className="section">
          <SectionHead title="À jour" count={data.up_to_date.length} to="/library?tab=up_to_date" />
          <div className="hscroll">
            {data.up_to_date.map((s) => <MediaCard key={s.id} item={{ ...s, type: 'tv' }} sub={s.upcoming_episode?.air_date ? `Prochain : ${relativeDay(s.upcoming_episode.air_date)}` : s.in_production ? 'En attente' : 'Terminée'} />)}
          </div>
        </section>
      ) : null}
    </div>
  );
}
