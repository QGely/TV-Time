import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../lib/api.js';
import { useToast } from '../lib/toast.jsx';
import { Icon } from '../components/Icons.jsx';
import { ErrorBox, Spinner } from '../components/Misc.jsx';

const LANG = { fr: '🇫🇷', en: '🇬🇧' };

function searchUrl(item) {
  return `https://duckduckgo.com/?q=${encodeURIComponent(item.search || item.title)}`;
}

function Item({ item, done, onToggle }) {
  return (
    <div className={'lib-item' + (done ? ' done' : '')}>
      <button className={'lib-check' + (done ? ' on' : '')} onClick={() => onToggle(item.id, !done)} aria-label={done ? 'Marquer comme non fait' : 'Marquer comme fait'} title={done ? 'Fait' : 'Marquer comme fait'}>{done ? <Icon.Check width={16} height={16} /> : null}</button>
      <div className="grow">
        <div className="lib-title">{item.lang ? <span className="lib-lang">{LANG[item.lang] || item.lang}</span> : null}{item.title}</div>
        {item.description ? <div className="lib-desc">{item.description}</div> : null}
        <div className="lib-meta">
          {item.access ? <span className={'chip ' + (/^gratuit$/i.test(item.access) ? 'chip-green' : /payant/i.test(item.access) ? 'chip-yellow' : 'chip-blue')}>{item.access}</span> : null}
          {item.kind ? <span className="chip">{item.kind}</span> : null}
          {item.note ? <span className="muted small">{item.note}</span> : null}
        </div>
      </div>
      {item.url
        ? <a className="btn btn-sm" href={item.url} target="_blank" rel="noreferrer">Ouvrir <Icon.External width={14} height={14} /></a>
        : <a className="btn btn-sm btn-ghost" href={searchUrl(item)} target="_blank" rel="noreferrer" title="Lien non vérifié : lancer une recherche"><Icon.Search width={14} height={14} /> Chercher</a>}
    </div>
  );
}

export function Library() {
  const { id } = useParams();
  const toast = useToast();
  const [lib, setLib] = useState(null);
  const [error, setError] = useState(null);
  const [q, setQ] = useState('');
  const [lang, setLang] = useState('');

  useEffect(() => { setLib(null); api.get(`/api/library/${id}`).then(setLib).catch(setError); }, [id]);

  const toggle = async (itemId, done) => {
    setLib((l) => { const d = { ...l.done }; if (done) d[itemId] = new Date().toISOString(); else delete d[itemId]; return { ...l, done: d }; });
    try { const r = await api.put(`/api/library/${id}/items/${itemId}`, { done }); setLib((l) => ({ ...l, done: r.done })); } catch (e) { toast(e.message, 'error'); }
  };

  const sections = useMemo(() => {
    if (!lib) return [];
    const s = q.trim().toLowerCase();
    return lib.sections.map((sec) => ({
      ...sec,
      items: (sec.items || []).filter((it) => (!lang || it.lang === lang) && (!s || `${it.title} ${it.description || ''} ${it.kind || ''}`.toLowerCase().includes(s))),
    })).filter((sec) => sec.items.length || sec.table || (!s && !lang));
  }, [lib, q, lang]);

  if (error) return <div className="page"><ErrorBox error={error} /></div>;
  if (!lib) return <div className="page"><Spinner /></div>;
  const checklist = lib.checklist || [];
  const checkDone = checklist.filter((c) => lib.done[c.id]).length;
  const totalItems = lib.sections.reduce((n, s) => n + (s.items || []).length, 0);
  const doneItems = lib.sections.reduce((n, s) => n + (s.items || []).filter((it) => lib.done[it.id]).length, 0);

  return (
    <div className="page" style={{ maxWidth: 980 }}>
      <div className="page-header">
        <div><h1>📚 {lib.title}</h1><p>{lib.subtitle}</p></div>
      </div>
      {lib.intro ? <div className="tips-box mb-16">{lib.intro}</div> : null}

      {checklist.length ? (
        <section className="section card card-pad">
          <div className="section-head"><h2>Mon programme prioritaire</h2><span className="chip chip-blue">{checkDone}/{checklist.length} réalisés</span></div>
          <div className="progress mb-12" style={{ height: 10 }}><div style={{ width: `${(checkDone / checklist.length) * 100}%` }} /></div>
          <div className="checklist">
            {checklist.map((c, i) => (
              <label key={c.id} className={'check-row' + (lib.done[c.id] ? ' done' : '')}>
                <input type="checkbox" checked={!!lib.done[c.id]} onChange={(e) => toggle(c.id, e.target.checked)} />
                <span className="check-n">{i + 1}</span>
                <span className="grow">{c.label}</span>
                {c.url ? <a href={c.url} target="_blank" rel="noreferrer" className="link-btn small" onClick={(e) => e.stopPropagation()}>Ouvrir</a> : c.to ? <Link to={c.to} className="link-btn small">Ouvrir</Link> : null}
              </label>
            ))}
          </div>
          {lib.method ? <p className="muted small mt-12">💡 {lib.method}</p> : null}
        </section>
      ) : null}

      <nav className="lib-toc mb-16" aria-label="Sommaire">
        {lib.sections.map((sec) => <a key={sec.id} href={`#sec-${sec.id}`} onClick={(e) => { e.preventDefault(); document.getElementById(`sec-${sec.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }}>{sec.title.replace(/^\d+\.\s*/, '')}</a>)}
      </nav>

      <div className="row wrap mb-16 lib-filters">
        <div className="lib-search"><Icon.Search /><input className="input" placeholder="Rechercher une ressource…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <div className="row">
          {[['', 'Toutes'], ['fr', '🇫🇷 Français'], ['en', '🇬🇧 Anglais']].map(([v, l]) => <button key={v} className={'chip' + (lang === v ? ' chip-blue' : '')} onClick={() => setLang(v)}>{l}</button>)}
        </div>
        <span className="muted small">{doneItems}/{totalItems} consultées</span>
      </div>

      {sections.map((sec) => (
        <section key={sec.id} id={`sec-${sec.id}`} className="section lib-section">
          <h2 className="mb-8">{sec.title}</h2>
          {sec.intro ? <p className="muted small mb-12">{sec.intro}</p> : null}
          {sec.table ? (
            <div className="lib-table mb-12">
              <div className="lib-trow head">{sec.table.columns.map((c) => <span key={c}>{c}</span>)}</div>
              {sec.table.rows.map((r, i) => <div key={i} className={'lib-trow' + (r.total ? ' total' : '')}>{r.cells.map((c, j) => <span key={j}>{c}</span>)}</div>)}
            </div>
          ) : null}
          {sec.warning ? <div className="lib-warning mb-12">⚠️ {sec.warning}</div> : null}
          <div className="lib-list">{sec.items.map((it) => <Item key={it.id} item={it} done={!!lib.done[it.id]} onToggle={toggle} />)}</div>
        </section>
      ))}

      {lib.footer ? <p className="muted small">{lib.footer}</p> : null}
    </div>
  );
}
