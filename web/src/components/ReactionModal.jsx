import { useEffect, useState } from 'react';
import { Modal } from './Modal.jsx';
import { REACTIONS } from '../lib/format.js';

/**
 * TV Time-like "How was it?" dialog: emoji reaction + optional /10 rating + watched date.
 */
export function ReactionModal({ open, onClose, title, subtitle, initial, onSave, allowDate = true }) {
  const [reaction, setReaction] = useState(initial?.reaction || null);
  const [rating, setRating] = useState(initial?.rating || null);
  const [date, setDate] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setReaction(initial?.reaction || null);
      setRating(initial?.rating || null);
      setDate(initial?.watched_at ? initial.watched_at.slice(0, 10) : '');
    }
  }, [open, initial]);

  const save = async () => {
    setSaving(true);
    try {
      await onSave({ reaction, rating, watched_at: date ? `${date}T20:00:00` : undefined });
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title={title}>
      {subtitle ? <p className="muted small mb-16">{subtitle}</p> : null}
      <div className="field mb-16">
        <label>Votre réaction</label>
        <div className="reaction-picker">
          {REACTIONS.map((r) => (
            <button key={r.id} type="button" className={reaction === r.id ? 'active' : ''} title={r.label} onClick={() => setReaction(reaction === r.id ? null : r.id)}>{r.emoji}</button>
          ))}
        </div>
      </div>
      <div className="field mb-16">
        <label>Note {rating ? `· ${rating}/10` : ''}</label>
        <div className="rating">
          {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
            <button key={n} type="button" className={rating === n ? 'active' : ''} onClick={() => setRating(rating === n ? null : n)}>{n}</button>
          ))}
        </div>
      </div>
      {allowDate ? (
        <div className="field">
          <label>Vu le</label>
          <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} max={new Date().toISOString().slice(0, 10)} />
          <span className="hint">Laisser vide pour aujourd'hui.</span>
        </div>
      ) : null}
      <div className="modal-actions">
        <button className="btn btn-ghost" onClick={onClose}>Annuler</button>
        <button className="btn btn-primary" onClick={save} disabled={saving}>Enregistrer</button>
      </div>
    </Modal>
  );
}
