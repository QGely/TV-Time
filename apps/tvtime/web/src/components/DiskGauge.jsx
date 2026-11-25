import { useEffect, useState } from 'react';
import { api } from '../lib/api.js';
import { bytes } from '../lib/format.js';

let cached = null;
let cachedAt = 0;

export function useSystemInfo() {
  const [info, setInfo] = useState(cached);
  useEffect(() => {
    let c = false;
    if (cached && Date.now() - cachedAt < 60e3) { setInfo(cached); return; }
    api.get('/api/settings/system').then((d) => { cached = d; cachedAt = Date.now(); if (!c) setInfo(d); }).catch(() => {});
    return () => { c = true; };
  }, []);
  return info;
}

/** Compact "free disk space" gauge for the sidebar. */
export function DiskGauge({ compact = true }) {
  const info = useSystemInfo();
  const disk = info?.disk;
  if (!disk || disk.error) return null;
  const pct = disk.percent_used;
  const level = pct >= 90 ? 'danger' : pct >= 75 ? 'warn' : 'ok';
  return (
    <div className={'disk-gauge' + (compact ? ' compact' : '')} title={`${bytes(disk.used)} utilisés sur ${bytes(disk.total)}`}>
      <div className="disk-gauge-head">
        <span>💾 Espace disque</span>
        <span className="disk-free">{bytes(disk.available)} libres</span>
      </div>
      <div className={'progress disk-' + level}><div style={{ width: `${pct}%` }} /></div>
      {!compact ? <div className="muted small mt-8">{bytes(disk.used)} utilisés sur {bytes(disk.total)} ({pct} %)</div> : null}
    </div>
  );
}
