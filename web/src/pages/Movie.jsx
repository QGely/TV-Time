import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Poster } from '../components/Poster.jsx';
import { SafeImg } from '../components/SafeImg.jsx';
import { ReactionModal } from '../components/ReactionModal.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';
import { img, fmtDate, reactionEmoji } from '../lib/format.js';

export function Movie() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [movie, setMovie] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [react, setReact] = useState(false);

  const load = useCallback(async () => {
    try { setError(null); setMovie(await api.get(`/api/movies/${id}`)); } catch (e) { setError(e); }
  }, [id]);
  useEffect(() => { setMovie(null); load(); }, [load]);

  const run = async (fn, msg) => {
    if (busy) return;
    setBusy(true);
    try { const m = await fn(); if (m?.id) setMovie(m); if (msg) toast(msg, 'success'); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };

  if (error) return <div className="page"><button className="btn btn-ghost mb-16" onClick={() => navigate(-1)}><Icon.Back /> Retour</button><ErrorBox error={error} onRetry={load} /></div>;
  if (!movie) return <div className="page"><Spinner /></div>;

  const h = movie.runtime ? `${Math.floor(movie.runtime / 60)} h ${String(movie.runtime % 60).padStart(2, '0')}` : null;

  return (
    <div className="page">
      <div className="hero">
        <div className="backdrop" style={{ backgroundImage: movie.backdrop_path ? `url(${img(movie.backdrop_path, 'w1280')})` : 'linear-gradient(160deg, #232733, #14161d)' }} />
        <button className="btn btn-icon back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Retour"><Icon.Back /></button>
        <div className="inner">
          <Poster path={movie.poster_path} title={movie.title} size="w342" />
          <div className="titles">
            <h1>{movie.title}</h1>
            {movie.tagline ? <p className="muted" style={{ fontStyle: 'italic' }}>{movie.tagline}</p> : null}
            <div className="meta">
              {movie.release_date ? <span>{movie.release_date.slice(0, 4)}</span> : null}
              {h ? <span>{h}</span> : null}
              {movie.vote_average ? <span>★ {movie.vote_average.toFixed(1)}</span> : null}
              <span className="chip chip-blue">Film</span>
            </div>
            {movie.genres?.length ? <div className="meta">{movie.genres.map((g) => <span key={g} className="chip">{g}</span>)}</div> : null}
          </div>
        </div>
      </div>

      <div className="detail-actions">
        {movie.status === 'watched' ? (
          <>
            <span className="chip chip-green"><Icon.Check width={14} height={14} /> Vu {movie.watched_at ? `le ${fmtDate(movie.watched_at)}` : ''}</span>
            <button className="btn" onClick={() => setReact(true)}>{movie.reaction ? reactionEmoji(movie.reaction) : '🙂'} {movie.rating ? `${movie.rating}/10` : 'Réagir'}</button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.post(`/api/movies/${id}/watchlist`), 'Remis dans la liste à voir')}>Marquer comme non vu</button>
          </>
        ) : (
          <>
            <button className="btn btn-primary" disabled={busy} onClick={() => run(() => api.post(`/api/movies/${id}/watched`), 'Film marqué comme vu')}><Icon.Check /> Je l'ai vu</button>
            {movie.status === 'watchlist' ? (
              <span className="chip chip-accent">Dans ma liste</span>
            ) : (
              <button className="btn" disabled={busy} onClick={() => run(() => api.post(`/api/movies/${id}/watchlist`), 'Ajouté à votre liste')}><Icon.Plus /> À voir plus tard</button>
            )}
          </>
        )}
        {movie.followed ? (
          <>
            <button className={'btn btn-icon' + (movie.favorite ? ' btn-primary' : '')} disabled={busy} title="Favori" onClick={() => run(() => api.put(`/api/movies/${id}/reaction`, { favorite: !movie.favorite }))}><Icon.Heart /></button>
            <button className="btn btn-ghost" disabled={busy} onClick={() => run(() => api.del(`/api/movies/${id}`), 'Film retiré')}><Icon.Trash /> Retirer</button>
          </>
        ) : null}
      </div>

      <div className="detail-grid">
        <div>
          {movie.overview ? <section className="section"><p className="overview">{movie.overview}</p></section> : null}
          {movie.cast?.length ? (
            <section className="section">
              <h3 className="mb-12">Distribution</h3>
              <div className="cast">
                {movie.cast.map((c) => (
                  <div key={c.id} className="person">
                    <div className="photo">{c.profile_path ? <SafeImg src={img(c.profile_path, 'w185')} loading="lazy" /> : null}</div>
                    <div className="name">{c.name}</div>
                    <div className="role">{c.character}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </div>
        <aside>
          <section className="section">
            <h3 className="mb-12">Informations</h3>
            <dl className="info-list">
              {movie.original_title && movie.original_title !== movie.title ? <><dt>Titre original</dt><dd>{movie.original_title}</dd></> : null}
              <dt>Sortie</dt><dd>{movie.release_date ? fmtDate(movie.release_date) : '—'}</dd>
              <dt>Durée</dt><dd>{h || '—'}</dd>
            </dl>
            <div className="row wrap mt-12">
              {movie.trailer_key ? <a className="btn btn-sm" href={`https://www.youtube.com/watch?v=${movie.trailer_key}`} target="_blank" rel="noreferrer"><Icon.Play /> Bande-annonce</a> : null}
              <a className="btn btn-sm btn-ghost" href={`https://www.themoviedb.org/movie/${movie.id}`} target="_blank" rel="noreferrer"><Icon.External /> TMDB</a>
              {movie.imdb_id ? <a className="btn btn-sm btn-ghost" href={`https://www.imdb.com/title/${movie.imdb_id}`} target="_blank" rel="noreferrer"><Icon.External /> IMDb</a> : null}
            </div>
          </section>
        </aside>
      </div>

      <ReactionModal open={react} onClose={() => setReact(false)} title={movie.title} subtitle="Comment avez-vous trouvé ce film ?" initial={movie}
        onSave={async ({ reaction, rating, watched_at }) => {
          await run(async () => {
            if (watched_at) await api.post(`/api/movies/${id}/watched`, { watched_at });
            return api.put(`/api/movies/${id}/reaction`, { reaction, rating });
          });
        }} />
    </div>
  );
}
