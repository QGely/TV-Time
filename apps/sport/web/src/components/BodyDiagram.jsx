/**
 * Simplified anatomical diagram (front + back) with muscle regions that light up.
 * primary → accent, secondary → lighter accent. Hover shows the French label.
 */
const LABELS = {
  chest: 'Pectoraux', front_delts: 'Deltoïdes antérieurs', side_delts: 'Deltoïdes latéraux', rear_delts: 'Deltoïdes postérieurs',
  biceps: 'Biceps', triceps: 'Triceps', forearms: 'Avant-bras', abs: 'Abdominaux', obliques: 'Obliques', quads: 'Quadriceps',
  hamstrings: 'Ischio-jambiers', glutes: 'Fessiers', calves: 'Mollets', lats: 'Grand dorsal', traps: 'Trapèzes',
  lower_back: 'Lombaires', upper_back: 'Haut du dos', hip_flexors: 'Fléchisseurs de hanche', adductors: 'Adducteurs',
  abductors: 'Abducteurs', neck: 'Cou',
};

const mirror = (shapes) => shapes.flatMap((s) => [s, { ...s, cx: s.cx !== undefined ? 220 - s.cx : undefined, points: s.points ? s.points.map(([x, y]) => [220 - x, y]) : undefined }]);
const E = (cx, cy, rx, ry, rot = 0) => ({ cx, cy, rx, ry, rot });
const P = (...points) => ({ points });

const FRONT = {
  neck: [{ points: [[100, 62], [120, 62], [122, 82], [98, 82]] }],
  traps: mirror([P([98, 80], [122, 80], [150, 92], [142, 98], [110, 92])]).slice(0, 1),
  chest: mirror([P([72, 92], [108, 94], [108, 134], [84, 140], [70, 122])]),
  front_delts: mirror([E(63, 102, 14, 19, -15)]),
  side_delts: mirror([E(50, 110, 9, 17, -10)]),
  biceps: mirror([E(55, 152, 12, 27, -6)]),
  forearms: mirror([E(45, 205, 10, 30, -8)]),
  abs: [{ points: [[92, 138], [128, 138], [128, 208], [92, 208]], rx: 10 }],
  obliques: mirror([P([74, 142], [90, 140], [90, 206], [84, 212], [70, 194])]),
  hip_flexors: mirror([P([84, 212], [108, 212], [106, 234], [88, 234])]),
  abductors: mirror([E(69, 232, 10, 20)]),
  adductors: mirror([P([100, 238], [110, 238], [112, 302], [102, 302])]),
  quads: mirror([E(86, 276, 17, 48, 4)]),
  calves: mirror([E(84, 392, 11, 28, 2)]),
};
const BACK = {
  neck: [{ points: [[100, 62], [120, 62], [122, 82], [98, 82]] }],
  traps: [P([80, 84], [140, 84], [118, 146], [102, 146])],
  rear_delts: mirror([E(63, 102, 14, 19, 15)]),
  upper_back: mirror([P([74, 98], [100, 94], [100, 140], [78, 138])]),
  lats: mirror([P([72, 140], [100, 142], [100, 204], [86, 204])]),
  lower_back: [P([96, 204], [124, 204], [128, 236], [92, 236])],
  triceps: mirror([E(55, 152, 12, 27, 6)]),
  forearms: mirror([E(45, 205, 10, 30, 8)]),
  glutes: mirror([E(90, 254, 20, 24)]),
  hamstrings: mirror([E(87, 320, 16, 44, 3)]),
  calves: mirror([E(85, 396, 12, 30, 2)]),
};

function Shape({ s, cls, title }) {
  if (s.points) {
    return <polygon points={s.points.map((p) => p.join(',')).join(' ')} className={cls}><title>{title}</title></polygon>;
  }
  return <ellipse cx={s.cx} cy={s.cy} rx={s.rx} ry={s.ry} transform={s.rot ? `rotate(${s.rot} ${s.cx} ${s.cy})` : undefined} className={cls}><title>{title}</title></ellipse>;
}

function Figure({ regions, primary, secondary, back }) {
  return (
    <svg viewBox="0 0 220 440" className="body-svg" aria-label={back ? 'Vue de dos' : 'Vue de face'}>
      <g className="silhouette">
        <circle cx="110" cy="38" r="26" />
        <path d="M98 62h24l4 20 24 10 14 20 8 100-14 10-10-66-6 4 6 160-10 10-16 110h-14l-6-108-2-80-2 80-6 108h-14l-16-110-10-10 6-160-6-4-10 66-14-10 8-100 14-20 24-10z" />
      </g>
      {Object.entries(regions).map(([id, shapes]) => shapes.map((s, i) => (
        <Shape key={id + i} s={s} title={LABELS[id]} cls={'muscle' + (primary.includes(id) ? ' primary' : secondary.includes(id) ? ' secondary' : '')} />
      )))}
      <text x="110" y="432" textAnchor="middle" className="body-label">{back ? 'Dos' : 'Face'}</text>
    </svg>
  );
}

export function BodyDiagram({ primary = [], secondary = [], size = 'md' }) {
  return (
    <div className={'body-diagram ' + size}>
      <Figure regions={FRONT} primary={primary} secondary={secondary} />
      <Figure regions={BACK} primary={primary} secondary={secondary} back />
    </div>
  );
}

export { LABELS as MUSCLE_LABELS };
