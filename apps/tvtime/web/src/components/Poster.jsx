import { useEffect, useState } from 'react';
import { img } from '../lib/format.js';
import { Icon } from './Icons.jsx';

export function Poster({ path, title, size = 'w342', percent, checked, badge, className = '' }) {
  const src = img(path, size);
  const [failed, setFailed] = useState(false);
  useEffect(() => { setFailed(false); }, [src]);
  return (
    <div className={'poster ' + className}>
      {src && !failed ? <img src={src} alt={title || ''} loading="lazy" onError={() => setFailed(true)} /> : <div className="placeholder">{title}</div>}
      {badge ? <span className="badge chip chip-accent">{badge}</span> : null}
      {checked ? <span className="check"><Icon.Check /></span> : null}
      {percent !== undefined && percent !== null ? <div className="bar"><div style={{ width: `${percent}%` }} /></div> : null}
    </div>
  );
}
