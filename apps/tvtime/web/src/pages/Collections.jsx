import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../lib/api.js';
import { img } from '../lib/format.js';
import { SafeImg } from '../components/SafeImg.jsx';
import { Empty, ErrorBox, Spinner } from '../components/Misc.jsx';

const CATEGORY_ORDER = ['marvel', 'dc', 'scifi', 'fantasy', 'action', 'horror', 'series', 'animation'];

export function CollectionCard({ c }) {
  return (
    <Link to={`/collections/${c.id}`} className="coll-card">
      <div className="coll-posters">
        {[0, 1, 2, 3].map((i) => (
          <span key={i} className="coll-poster">{c.posters?.[i] ? <SafeImg src={img(c.posters[i], 'w185')} loading="lazy" /> : null}</span>
        ))}
        <span className="coll-icon">{c.icon}</span>
      </div>
      <div className="coll-body">
        <div className="coll-name">{c.name}</div>
        <div className="coll-sub">
          {c.movie_count ? `${c.movie_count} film${c.movie_count > 1 ? 's' : ''}` : ''}
          {c.movie_count && c.tv_count ? ' · ' : ''}
          {c.tv_count ? `${c.tv_count} série${c.tv_count > 1 ? 's' : ''}` : ''}
        </div>
        <div className="progress mt-8"><div style={{ width: `${c.percent}%` }} /></div>
        <div className="coll-progress">{c.done_count}/{c.item_count} vus</div>
      </div>
    </Link>
  );
}

export function Collections() {
  const [list, setList] = useState(null);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    api.get('/api/collections').then(setList).catch(setError);
  }, []);

  const grouped = useMemo(() => {
    if (!list) return [];
    const byCat = new Map();
    for (const c of list) {
      if (filter === 'started' && !c.started_count) continue;
      if (!byCat.has(c.category)) byCat.set(c.category, { key: c.category, label: c.category_label, items: [] });
      byCat.get(c.category).items.push(c);
    }
    return [...byCat.values()].sort((a, b) => {
      const ia = CATEGORY_ORDER.indexOf(a.key), ib = CATEGORY_ORDER.indexOf(b.key);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [list, filter]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!list) return <div className="page"><Spinner /></div>;

  return (
    <div className="page">
      <div className="page-header">
        <div><h1>Collections</h1><p>Des univers entiers dans le bon ordre : marquez ce que vous avez vu et suivez votre progression.</p></div>
        <div className="tabs">
          <button className={'tab' + (filter === 'all' ? ' active' : '')} onClick={() => setFilter('all')}>Toutes<span className="count">{list.length}</span></button>
          <button className={'tab' + (filter === 'started' ? ' active' : '')} onClick={() => setFilter('started')}>Commencées<span className="count">{list.filter((c) => c.started_count).length}</span></button>
        </div>
      </div>
      {list.length === 0 ? <Empty icon="🗂️" title="Aucune collection" text="Les fichiers de collections sont absents du serveur." /> : null}
      {grouped.length === 0 && list.length ? <Empty icon="🍿" title="Aucune collection commencée" text="Ouvrez une collection et cochez votre premier film." /> : null}
      {grouped.map((g) => (
        <section key={g.key} className="section">
          <div className="section-head"><h2>{g.label} <span className="count">{g.items.length}</span></h2></div>
          <div className="coll-grid">{g.items.map((c) => <CollectionCard key={c.id} c={c} />)}</div>
        </section>
      ))}
    </div>
  );
}
