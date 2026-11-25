import { useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api.js';
import { Modal } from './Modal.jsx';
import { Icon } from './Icons.jsx';
import { CATEGORY_ICONS } from '../lib/format.js';
import { Spinner } from './Misc.jsx';

let cache = null;

export function useExercises() {
  const [list, setList] = useState(cache);
  useEffect(() => {
    let c = false;
    api.get('/api/exercises').then((d) => { cache = d; if (!c) setList(d); }).catch(() => {});
    return () => { c = true; };
  }, []);
  return list;
}

export function ExercisePicker({ open, onClose, onPick, multiple = false }) {
  const list = useExercises();
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('');
  const [meta, setMeta] = useState(null);
  const [selected, setSelected] = useState([]);
  useEffect(() => { api.get('/api/exercises/meta').then(setMeta).catch(() => {}); }, []);
  useEffect(() => { if (open) { setSelected([]); setQ(''); } }, [open]);
  const filtered = useMemo(() => {
    const s = q.trim().toLowerCase();
    return (list || []).filter((e) => (!cat || e.category === cat) && (!s || e.name.toLowerCase().includes(s) || (e.name_en || '').toLowerCase().includes(s)));
  }, [list, q, cat]);
  const toggle = (e) => {
    if (!multiple) { onPick(e); onClose(); return; }
    setSelected((sel) => (sel.find((x) => x.id === e.id) ? sel.filter((x) => x.id !== e.id) : [...sel, e]));
  };
  return (
    <Modal open={open} onClose={onClose} title="Choisir un exercice">
      <div className="searchbar mb-12"><Icon.Search /><input className="input" placeholder="Rechercher…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus /></div>
      <div className="tabs mb-12">
        <button className={'tab' + (!cat ? ' active' : '')} onClick={() => setCat('')}>Tous</button>
        {meta ? Object.entries(meta.categories).map(([k, v]) => <button key={k} className={'tab' + (cat === k ? ' active' : '')} onClick={() => setCat(k)}>{CATEGORY_ICONS[k]} {v}</button>) : null}
      </div>
      <div className="picker-list">
        {!list ? <Spinner /> : filtered.slice(0, 200).map((e) => {
          const on = selected.some((x) => x.id === e.id);
          return (
            <button key={e.id} className={'picker-item' + (on ? ' on' : '')} onClick={() => toggle(e)}>
              <span className="picker-icon">{CATEGORY_ICONS[e.category]}</span>
              <span className="grow"><span className="picker-name">{e.name}</span><span className="picker-sub">{meta?.equipment[e.equipment] || e.equipment}{e.usage ? ` · ${e.usage}×` : ''}</span></span>
              {on ? <Icon.Check /> : <Icon.Plus />}
            </button>
          );
        })}
        {list && !filtered.length ? <p className="muted">Aucun exercice.</p> : null}
      </div>
      {multiple ? (
        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
          <button className="btn btn-primary" disabled={!selected.length} onClick={() => { onPick(selected); onClose(); }}>Ajouter {selected.length ? `(${selected.length})` : ''}</button>
        </div>
      ) : null}
    </Modal>
  );
}
