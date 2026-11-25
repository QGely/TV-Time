import { Link } from 'react-router-dom';
import { Poster } from './Poster.jsx';
import { year, STATUS_LABELS } from '../lib/format.js';

/** Poster card for search / discover results and library grids. */
export function MediaCard({ item, sub }) {
  const isMovie = item.type === 'movie';
  const to = isMovie ? `/movie/${item.id}` : `/show/${item.id}`;
  const title = item.name || item.title;
  const subText = sub !== undefined ? sub : (item.status && STATUS_LABELS[item.status]) || year(item.date || item.first_air_date || item.release_date) || (isMovie ? 'Film' : 'Série');
  return (
    <Link to={to} className="media-card">
      <Poster path={item.poster_path} title={title} percent={item.percent} checked={item.followed || item.status === 'watched'} badge={isMovie && item.type ? 'Film' : null} />
      <div className="title clamp-2">{title}</div>
      {subText ? <div className="sub ellipsis">{subText}</div> : null}
    </Link>
  );
}
