import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useAuth } from '../lib/auth.jsx';
import { Avatar } from '../components/Avatar.jsx';
import { Poster } from '../components/Poster.jsx';
import { Icon } from '../components/Icons.jsx';
import { ErrorBox, SectionHead, Spinner } from '../components/Misc.jsx';
import { duration, durationText, epCode, fmtDate, reactionEmoji, timeAgo, REACTIONS, STATUS_LABELS } from '../lib/format.js';

const MONTHS = ['jan', 'fév', 'mar', 'avr', 'mai', 'juin', 'juil', 'aoû', 'sep', 'oct', 'nov', 'déc'];
const DOW = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];

export function Profile() {
  const { user, logout } = useAuth();
  const [stats, setStats] = useState(null);
  const [feed, setFeed] = useState(null);
  const [feedScope, setFeedScope] = useState('all');
  const [error, setError] = useState(null);

  useEffect(() => {
    api.get('/api/profile/stats').then(setStats).catch(setError);
  }, []);
  useEffect(() => {
    setFeed(null);
    api.get(`/api/profile/feed?limit=40${feedScope === 'me' ? '&me=1' : ''}`).then(setFeed).catch(() => setFeed([]));
  }, [feedScope]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!stats) return <div className="page"><Spinner /></div>;

  const d = duration(stats.minutes);
  const maxMonth = Math.max(1, ...stats.months.map((m) => m.minutes));
  const maxGenre = Math.max(1, ...stats.genres.map((g) => g.minutes));
  const maxDow = Math.max(1, ...stats.weekdays);
  const dowOrder = [1, 2, 3, 4, 5, 6, 0];

  return (
    <div className="page">
      <div className="profile-head">
        <Avatar user={user} size="lg" />
        <div className="grow">
          <h1>{user.display_name}</h1>
          <p className="muted">@{user.username} · membre depuis {fmtDate(user.created_at, 'short')}{user.is_admin ? ' · admin' : ''}</p>
        </div>
        <Link to="/settings" className="btn btn-icon" title="Paramètres"><Icon.Settings /></Link>
        <button className="btn btn-icon btn-ghost" onClick={logout} title="Se déconnecter"><Icon.Logout /></button>
      </div>

      <section className="section">
        <SectionHead title="Temps passé devant les séries" />
        <div className="time-blocks">
          <div className="time-block"><div className="value">{d.months}</div><div className="label">mois</div></div>
          <div className="time-block"><div className="value">{d.days}</div><div className="label">jours</div></div>
          <div className="time-block"><div className="value">{d.hours}</div><div className="label">heures</div></div>
        </div>
        <div className="stats-strip mt-12">
          <div className="stat"><div className="value">{stats.episodes}</div><div className="label">Épisodes</div></div>
          <div className="stat"><div className="value">{stats.shows}</div><div className="label">Séries</div></div>
          <div className="stat"><div className="value">{stats.movies}</div><div className="label">Films</div></div>
        </div>
        {stats.streak.current > 0 || stats.streak.best > 1 ? (
          <p className="muted small mt-12">🔥 Série en cours : {stats.streak.current} jour{stats.streak.current > 1 ? 's' : ''} · record : {stats.streak.best} jour{stats.streak.best > 1 ? 's' : ''}</p>
        ) : null}
      </section>

      <div className="detail-grid">
        <div>
          <section className="section">
            <SectionHead title="Activité des 12 derniers mois" />
            <div className="card card-pad">
              <div className="bars">
                {stats.months.map((m) => (
                  <div key={m.key} className="bar" title={`${m.episodes} épisodes · ${m.movies} films · ${durationText(m.minutes)}`}>
                    <div className={'fill' + (m.minutes ? '' : ' dim')} style={{ height: `${Math.max(2, (m.minutes / maxMonth) * 100)}%` }} />
                    <div className="lbl">{MONTHS[Number(m.key.slice(5, 7)) - 1]}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {stats.genres.length ? (
            <section className="section">
              <SectionHead title="Genres préférés" />
              <div className="card card-pad">
                {stats.genres.map((g) => (
                  <div key={g.name} className="hbar">
                    <span className="ellipsis">{g.name}</span>
                    <div className="track"><div style={{ width: `${(g.minutes / maxGenre) * 100}%` }} /></div>
                    <span className="val">{durationText(g.minutes)}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section className="section">
            <SectionHead title="Jours de visionnage" />
            <div className="card card-pad">
              <div className="bars" style={{ height: 80 }}>
                {dowOrder.map((i) => (
                  <div key={i} className="bar" title={`${stats.weekdays[i]} épisodes`}>
                    <div className={'fill' + (stats.weekdays[i] ? '' : ' dim')} style={{ height: `${Math.max(2, (stats.weekdays[i] / maxDow) * 100)}%` }} />
                    <div className="lbl">{DOW[i]}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="section">
            <SectionHead title="Badges" count={`${stats.badges.filter((b) => b.unlocked).length}/${stats.badges.length}`} />
            <div className="badges">
              {stats.badges.map((b) => (
                <div key={b.id} className={'badge-card' + (b.unlocked ? '' : ' locked')}><div className="icon">{b.icon}</div><div className="name">{b.label}</div></div>
              ))}
            </div>
          </section>
        </div>

        <aside>
          {stats.top_shows.length ? (
            <section className="section">
              <SectionHead title="Top séries" />
              <div className="top-list">
                {stats.top_shows.slice(0, 5).map((s, i) => (
                  <Link key={s.id} to={`/show/${s.id}`} className="top-item">
                    <span className="rank">{i + 1}</span>
                    <Poster path={s.poster_path} title={s.name} size="w92" />
                    <div className="grow">
                      <div className="name ellipsis">{s.name}</div>
                      <div className="sub">{s.episodes} ép. · {durationText(s.minutes)} · {STATUS_LABELS[s.status]}</div>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          ) : null}
          {Object.keys(stats.reactions).length ? (
            <section className="section">
              <SectionHead title="Vos réactions" />
              <div className="row wrap">
                {REACTIONS.filter((r) => stats.reactions[r.id]).map((r) => <span key={r.id} className="chip">{r.emoji} {stats.reactions[r.id]}</span>)}
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <section className="section">
        <SectionHead title="Activité récente" right={(
          <div className="tabs">
            <button className={'tab' + (feedScope === 'all' ? ' active' : '')} onClick={() => setFeedScope('all')}>Tout le monde</button>
            <button className={'tab' + (feedScope === 'me' ? ' active' : '')} onClick={() => setFeedScope('me')}>Moi</button>
          </div>
        )} />
        {!feed ? <Spinner /> : feed.length === 0 ? <p className="muted">Aucune activité pour le moment.</p> : (
          <div className="feed">
            {feed.map((item, i) => (
              <Link key={i} to={item.kind === 'movie' ? `/movie/${item.movie_id}` : `/show/${item.show_id}`} className="feed-item">
                <Poster path={item.poster_path} title={item.title} size="w92" />
                <div className="grow">
                  <div><span className="who">{item.user_id === user.id ? 'Vous' : item.display_name}</span> <span className="what">{(item.user_id === user.id ? 'avez vu' : 'a vu') + (item.kind === 'movie' ? ' le film' : item.count > 1 ? ` ${item.count} épisodes de` : '')}</span></div>
                  <div className="what"><b>{item.title}</b>{item.kind === 'episode' && item.count === 1 ? ` · ${epCode(item)} ${item.episode_name || ''}` : ''}</div>
                  <div className="when">{timeAgo(item.at)}{item.rating ? ` · ${item.rating}/10` : ''}</div>
                </div>
                {item.reaction ? <span className="reaction">{reactionEmoji(item.reaction)}</span> : null}
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
