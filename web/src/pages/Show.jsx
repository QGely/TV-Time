import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { Poster } from '../components/Poster.jsx';
import { SafeImg } from '../components/SafeImg.jsx';
import { Modal } from '../components/Modal.jsx';
import { ReactionModal } from '../components/ReactionModal.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';
import { img, epCode, fmtDate, relativeDay, reactionEmoji, durationText, STATUS_LABELS, SHOW_STATUS_LABELS, todayStr } from '../lib/format.js';

export function Show() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [show, setShow] = useState(null);
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [openSeasons, setOpenSeasons] = useState(new Set());
  const [reactionTarget, setReactionTarget] = useState(null);
  const [confirmUnfollow, setConfirmUnfollow] = useState(false);
  const [showFullOverview, setShowFullOverview] = useState(false);

  const load = useCallback(async () => {
    try {
      setError(null);
      const s = await api.get(`/api/shows/${id}`);
      setShow(s);
      // Open the season containing the next episode by default (or the last one).
      const target = s.next_episode?.season_number ?? s.seasons[s.seasons.length - 1]?.season_number;
      if (target !== undefined) setOpenSeasons(new Set([target]));
    } catch (e) {
      setError(e);
    }
  }, [id]);

  useEffect(() => { setShow(null); load(); }, [load]);

  const run = async (fn, successMsg) => {
    if (busy) return;
    setBusy(true);
    try {
      const s = await fn();
      if (s?.id) setShow(s);
      if (successMsg) toast(successMsg, 'success');
    } catch (e) {
      toast(e.message, 'error');
    } finally {
      setBusy(false);
    }
  };

  const follow = () => run(() => api.post(`/api/shows/${id}/follow`), 'Série ajoutée à votre liste');
  const unfollow = () => { setConfirmUnfollow(false); run(() => api.del(`/api/shows/${id}/follow`), 'Série retirée de votre liste'); };
  const setList = (list) => run(() => api.put(`/api/shows/${id}/list`, { list }));
  const toggleFav = () => run(() => api.put(`/api/shows/${id}/list`, { favorite: !show.favorite }));
  const watchEpisode = (ep, previous = false) => run(() => api.post(`/api/shows/${id}/episodes/${ep.id}/watch`, { previous }));
  const unwatchEpisode = (ep) => run(() => api.del(`/api/shows/${id}/episodes/${ep.id}/watch`));
  const watchSeason = (n) => run(() => api.post(`/api/shows/${id}/seasons/${n}/watch`), `Saison ${n} marquée comme vue`);
  const unwatchSeason = (n) => run(() => api.del(`/api/shows/${id}/seasons/${n}/watch`));
  const watchAll = () => run(() => api.post(`/api/shows/${id}/watch-all`), 'Tous les épisodes marqués comme vus');
  const refresh = () => run(() => api.post(`/api/shows/${id}/refresh`), 'Données mises à jour depuis TMDB');
  const saveReaction = async ({ reaction, rating, watched_at }) => {
    await run(() => api.put(`/api/shows/${id}/episodes/${reactionTarget.id}/reaction`, { reaction, rating, watched_at }));
  };

  const toggleSeason = (n) => setOpenSeasons((s) => { const c = new Set(s); c.has(n) ? c.delete(n) : c.add(n); return c; });

  if (error) return <div className="page"><button className="btn btn-ghost mb-16" onClick={() => navigate(-1)}><Icon.Back /> Retour</button><ErrorBox error={error} onRetry={load} /></div>;
  if (!show) return <div className="page"><Spinner /></div>;

  const t = todayStr();
  const next = show.next_episode;
  const regularSeasons = show.seasons.filter((s) => s.season_number > 0);
  const specials = show.seasons.filter((s) => s.season_number === 0);

  return (
    <div className="page">
      <div className="hero">
        <div className="backdrop" style={{ backgroundImage: show.backdrop_path ? `url(${img(show.backdrop_path, 'w1280')})` : 'linear-gradient(160deg, #232733, #14161d)' }} />
        <button className="btn btn-icon back" onClick={() => (window.history.length > 1 ? navigate(-1) : navigate('/'))} aria-label="Retour"><Icon.Back /></button>
        <div className="inner">
          <Poster path={show.poster_path} title={show.name} size="w342" />
          <div className="titles">
            <h1>{show.name}</h1>
            <div className="meta">
              {show.first_air_date ? <span>{show.first_air_date.slice(0, 4)}</span> : null}
              {show.air_status ? <span className="chip">{SHOW_STATUS_LABELS[show.air_status] || show.air_status}</span> : null}
              {show.networks?.[0] ? <span>{show.networks[0].name}</span> : null}
              {show.episode_run_time ? <span>{show.episode_run_time} min</span> : null}
              {show.vote_average ? <span>★ {show.vote_average.toFixed(1)}</span> : null}
            </div>
            {show.genres?.length ? <div className="meta">{show.genres.map((g) => <span key={g} className="chip">{g}</span>)}</div> : null}
          </div>
        </div>
      </div>

      <div className="detail-actions">
        {show.followed ? (
          <>
            <select className="input" style={{ width: 'auto' }} value={show.list} onChange={(e) => setList(e.target.value)} disabled={busy}>
              <option value="watching">{show.status === 'up_to_date' ? 'À jour' : show.status === 'not_started' ? 'Pas commencée' : 'En cours'}</option>
              <option value="for_later">Pour plus tard</option>
              <option value="stopped">Arrêtée</option>
            </select>
            <button className={'btn btn-icon' + (show.favorite ? ' btn-primary' : '')} onClick={toggleFav} title="Favori" disabled={busy}><Icon.Heart /></button>
            {show.remaining_count > 0 ? <button className="btn" onClick={watchAll} disabled={busy}><Icon.Check /> Tout marquer comme vu</button> : null}
            <button className="btn btn-ghost" onClick={() => setConfirmUnfollow(true)} disabled={busy}><Icon.Trash /> Retirer</button>
          </>
        ) : (
          <button className="btn btn-primary" onClick={follow} disabled={busy}><Icon.Plus /> Suivre cette série</button>
        )}
        <button className="btn btn-ghost btn-icon" onClick={refresh} title="Actualiser depuis TMDB" disabled={busy}><Icon.Refresh /></button>
      </div>

      {show.followed ? (
        <div className="card card-pad mb-16">
          <div className="row wrap" style={{ justifyContent: 'space-between' }}>
            <div>
              <b>{show.watched_count}</b> / {show.aired_count} épisodes vus
              <span className="muted"> · {STATUS_LABELS[show.status]}</span>
            </div>
            <div className="muted small">{durationText(show.minutes_watched)} devant l'écran</div>
          </div>
          <div className="progress mt-8"><div style={{ width: `${show.percent}%` }} /></div>
        </div>
      ) : null}

      {next ? (
        <div className="next-up">
          <div className="still">{next.still_path ? <SafeImg src={img(next.still_path, 'w300')} /> : null}</div>
          <div className="grow">
            <div className="label">Prochain épisode à voir</div>
            <div><b>{epCode(next)}</b> · {next.name}</div>
            <div className="muted small">{next.air_date ? fmtDate(next.air_date) : ''}{show.remaining_count > 1 ? ` · ${show.remaining_count - 1} autres à suivre` : ''}</div>
          </div>
          <button className="check-btn" onClick={() => watchEpisode(next)} disabled={busy} aria-label="Marquer comme vu"><Icon.Check /></button>
        </div>
      ) : show.upcoming_episode ? (
        <div className="next-up">
          <div className="still">{show.upcoming_episode.still_path ? <SafeImg src={img(show.upcoming_episode.still_path, 'w300')} /> : null}</div>
          <div className="grow">
            <div className="label">Prochain épisode diffusé</div>
            <div><b>{epCode(show.upcoming_episode)}</b> · {show.upcoming_episode.name || 'Titre à venir'}</div>
            <div className="muted small">{show.upcoming_episode.air_date ? `${relativeDay(show.upcoming_episode.air_date)} · ${fmtDate(show.upcoming_episode.air_date)}` : 'Date inconnue'}</div>
          </div>
        </div>
      ) : null}

      <div className="detail-grid">
        <div>
          {show.overview ? (
            <section className="section">
              <p className={'overview' + (showFullOverview ? '' : ' collapsed')}>{show.overview}</p>
              {show.overview.length > 280 ? <button className="link-btn mt-8" onClick={() => setShowFullOverview((v) => !v)}>{showFullOverview ? 'Réduire' : 'Lire la suite'}</button> : null}
            </section>
          ) : null}

          <section className="section">
            <h2 className="mb-12">Saisons</h2>
            {regularSeasons.map((s) => (
              <Season key={s.season_number} season={s} open={openSeasons.has(s.season_number)} onToggle={() => toggleSeason(s.season_number)}
                busy={busy} today={t} onWatch={watchEpisode} onUnwatch={unwatchEpisode} onWatchSeason={watchSeason} onUnwatchSeason={unwatchSeason} onReact={setReactionTarget} />
            ))}
            {specials.map((s) => (
              <Season key={s.season_number} season={s} open={openSeasons.has(0)} onToggle={() => toggleSeason(0)}
                busy={busy} today={t} onWatch={watchEpisode} onUnwatch={unwatchEpisode} onWatchSeason={watchSeason} onUnwatchSeason={unwatchSeason} onReact={setReactionTarget} />
            ))}
          </section>
        </div>

        <aside>
          {show.cast?.length ? (
            <section className="section">
              <h3 className="mb-12">Distribution</h3>
              <div className="cast">
                {show.cast.map((c) => (
                  <div key={c.id} className="person">
                    <div className="photo">{c.profile_path ? <SafeImg src={img(c.profile_path, 'w185')} loading="lazy" /> : null}</div>
                    <div className="name">{c.name}</div>
                    <div className="role">{c.character}</div>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
          <section className="section">
            <h3 className="mb-12">Informations</h3>
            <dl className="info-list">
              {show.original_name && show.original_name !== show.name ? <><dt>Titre original</dt><dd>{show.original_name}</dd></> : null}
              <dt>Première diffusion</dt><dd>{show.first_air_date ? fmtDate(show.first_air_date) : '—'}</dd>
              <dt>Saisons</dt><dd>{show.number_of_seasons}</dd>
              <dt>Épisodes</dt><dd>{show.number_of_episodes}</dd>
              {show.networks?.length ? <><dt>Chaîne</dt><dd>{show.networks.map((n) => n.name).join(', ')}</dd></> : null}
              <dt>Statut</dt><dd>{SHOW_STATUS_LABELS[show.air_status] || show.air_status || '—'}</dd>
            </dl>
            <div className="row wrap mt-12">
              {show.trailer_key ? <a className="btn btn-sm" href={`https://www.youtube.com/watch?v=${show.trailer_key}`} target="_blank" rel="noreferrer"><Icon.Play /> Bande-annonce</a> : null}
              <a className="btn btn-sm btn-ghost" href={`https://www.themoviedb.org/tv/${show.id}`} target="_blank" rel="noreferrer"><Icon.External /> TMDB</a>
              {show.imdb_id ? <a className="btn btn-sm btn-ghost" href={`https://www.imdb.com/title/${show.imdb_id}`} target="_blank" rel="noreferrer"><Icon.External /> IMDb</a> : null}
            </div>
          </section>
        </aside>
      </div>

      <ReactionModal open={!!reactionTarget} onClose={() => setReactionTarget(null)} title={reactionTarget ? `${epCode(reactionTarget)} · ${reactionTarget.name}` : ''}
        subtitle="Comment avez-vous trouvé cet épisode ?" initial={reactionTarget} onSave={saveReaction} />

      <Modal open={confirmUnfollow} onClose={() => setConfirmUnfollow(false)} title="Retirer cette série ?">
        <p className="muted">Votre historique d'épisodes vus pour cette série sera supprimé.</p>
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={() => setConfirmUnfollow(false)}>Annuler</button>
          <button className="btn btn-danger" onClick={unfollow}>Retirer</button>
        </div>
      </Modal>
    </div>
  );
}

function Season({ season, open, onToggle, busy, today, onWatch, onUnwatch, onWatchSeason, onUnwatchSeason, onReact }) {
  const total = season.episodes.length;
  const aired = season.aired_count;
  const watched = season.watched_count;
  const pct = aired ? Math.round((Math.min(watched, aired) / aired) * 100) : 0;
  const allSeen = aired > 0 && watched >= aired;
  return (
    <div className="season">
      <div className="season-head" onClick={onToggle}>
        <div className="sposter">{season.poster_path ? <SafeImg src={img(season.poster_path, 'w185')} loading="lazy" /> : null}</div>
        <div className="grow">
          <div className="stitle">{season.name || `Saison ${season.season_number}`}</div>
          <div className="ssub">{watched}/{aired} vus{total > aired ? ` · ${total - aired} à venir` : ''}{season.air_date ? ` · ${season.air_date.slice(0, 4)}` : ''}</div>
        </div>
        <div className={'progress' + (allSeen ? ' green' : '')}><div style={{ width: `${pct}%` }} /></div>
        <Icon.ChevronDown className={'chev' + (open ? ' open' : '')} width={20} height={20} />
      </div>
      {open ? (
        <div className="season-body">
          {aired > 0 ? (
            <div className="season-tools">
              {!allSeen ? <button className="btn btn-sm" disabled={busy} onClick={() => onWatchSeason(season.season_number)}><Icon.Check /> Marquer la saison comme vue</button> : null}
              {watched > 0 ? <button className="btn btn-sm btn-ghost" disabled={busy} onClick={() => onUnwatchSeason(season.season_number)}>Tout décocher</button> : null}
            </div>
          ) : null}
          {season.episodes.map((ep) => <EpisodeRow key={ep.id} ep={ep} today={today} busy={busy} onWatch={onWatch} onUnwatch={onUnwatch} onReact={onReact} />)}
        </div>
      ) : null}
    </div>
  );
}

function EpisodeRow({ ep, today, busy, onWatch, onUnwatch, onReact }) {
  const [expanded, setExpanded] = useState(false);
  const future = !ep.air_date || ep.air_date > today;
  return (
    <div className={'ep-row' + (future ? ' future' : '')}>
      <div className="still" onClick={() => setExpanded((v) => !v)}>{ep.still_path ? <SafeImg src={img(ep.still_path, 'w300')} loading="lazy" /> : null}</div>
      <div className="info" onClick={() => setExpanded((v) => !v)} style={{ cursor: ep.overview ? 'pointer' : 'default' }}>
        <div className="code">{epCode(ep)}{ep.runtime ? <span className="muted"> · {ep.runtime} min</span> : null}</div>
        <div className="name clamp-2">{ep.name || 'Épisode ' + ep.episode_number}</div>
        <div className="date">{ep.air_date ? (future ? `${relativeDay(ep.air_date)} · ${fmtDate(ep.air_date)}` : fmtDate(ep.air_date)) : 'Date inconnue'}{ep.watched && ep.rating ? ` · note ${ep.rating}/10` : ''}</div>
        {expanded && ep.overview ? <div className="expand">{ep.overview}</div> : null}
      </div>
      {ep.watched ? (
        <button className="btn btn-ghost btn-icon reaction" onClick={() => onReact(ep)} title="Réagir" aria-label="Réagir">{ep.reaction ? reactionEmoji(ep.reaction) : '🙂'}</button>
      ) : null}
      {!future ? (
        <button className={'check-btn sm' + (ep.watched ? ' done' : '')} disabled={busy} title={ep.watched ? 'Marquer comme non vu' : 'Marquer comme vu (clic droit : avec les précédents)'}
          onClick={() => (ep.watched ? onUnwatch(ep) : onWatch(ep))}
          onContextMenu={(e) => { e.preventDefault(); if (!ep.watched) onWatch(ep, true); }}
          aria-label={ep.watched ? 'Vu' : 'Non vu'}>
          <Icon.Check />
        </button>
      ) : <span className="chip">{relativeDay(ep.air_date)}</span>}
    </div>
  );
}
