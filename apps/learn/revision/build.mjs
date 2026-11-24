/**
 * Mémento de révision LAPL(A) / PPL(A) : génère le PDF à partir de chapters/u1.json … u9.json.
 *
 *   node build.mjs                      → LAPL-PPL-memento.pdf (document complet)
 *   node build.mjs --check              → vérifie le format des chapitres
 *   node build.mjs --only u3 --png DIR  → rend uniquement le chapitre u3 et exporte ses pages en PNG (relecture)
 *
 * Nécessite Playwright (Chromium) et pdftotext / pdftoppm (poppler).
 */
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createRequire } from 'node:module';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const CH_DIR = path.join(HERE, 'chapters');
const FONT_DIR = pathToFileURL(path.join(HERE, 'fonts')).href;
const LIB = path.resolve(HERE, '../server/src/data/libraries/lapl.json');
const COURSE = path.resolve(HERE, '../server/src/data/courses/lapl.json');

const args = process.argv.slice(2);
const opt = (name) => { const i = args.indexOf(name); return i >= 0 ? (args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true) : null; };
const ONLY = opt('--only');
const PNG = opt('--png');
const OUT = opt('--out') || path.join(HERE, 'LAPL-PPL-memento.pdf');

const UNITS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8', 'u9'];
// Une couleur par matière : onglet, bandeau d'ouverture, titres de section.
const COLORS = {
  u1: '#1d4e89', u2: '#a23b72', u3: '#2b7a9b', u4: '#6a4c93', u5: '#c0392b',
  u6: '#2e7d4f', u7: '#d35400', u8: '#7a5c2e', u9: '#37474f',
};

// ───────────────────────── validation ─────────────────────────
const BLOCK_TYPES = {
  text: ['text'], bullets: ['items'], steps: ['items'], table: ['columns', 'rows'], formula: ['label', 'formula'],
  memo: ['text'], trap: ['text'], key: ['text'], example: ['text'], code: ['text'], dialog: ['lines'], diagram: ['svg'], compare: ['items'],
};

export function checkChapter(c, file = '') {
  const p = [];
  const need = (cond, msg) => { if (!cond) p.push(msg); };
  need(UNITS.includes(c.unit), 'unit doit valoir u1…u9');
  need(typeof c.title === 'string' && c.title, 'title manquant');
  need(c.exam && Number.isInteger(c.exam.questions) && Number.isInteger(c.exam.minutes), 'exam {questions, minutes} manquant');
  need(typeof c.pitch === 'string' && c.pitch.length > 40, 'pitch manquant ou trop court');
  need(Array.isArray(c.essentials) && c.essentials.length >= 6 && c.essentials.length <= 14, 'essentials : 6 à 14 phrases');
  need(Array.isArray(c.sections) && c.sections.length >= 3, 'sections : au moins 3');
  (c.sections || []).forEach((s, i) => {
    const w = `sections[${i}]`;
    need(s.title, `${w}: title manquant`);
    need(Array.isArray(s.blocks) && s.blocks.length, `${w}: blocks vides`);
    (s.blocks || []).forEach((b, j) => {
      const bw = `${w}.blocks[${j}]`;
      const req = BLOCK_TYPES[b.type];
      if (!req) { p.push(`${bw}: type inconnu « ${b.type} » (types : ${Object.keys(BLOCK_TYPES).join(', ')})`); return; }
      for (const k of req) need(b[k] !== undefined && b[k] !== '' && !(Array.isArray(b[k]) && !b[k].length), `${bw} (${b.type}): champ ${k} manquant`);
      if (b.type === 'table' && Array.isArray(b.rows) && Array.isArray(b.columns)) b.rows.forEach((r, k) => need(Array.isArray(r) && r.length === b.columns.length, `${bw}: ligne ${k} n'a pas ${b.columns.length} cellules`));
      if (b.type === 'dialog' && Array.isArray(b.lines)) b.lines.forEach((l, k) => need(l.who && l.text, `${bw}: réplique ${k} incomplète (who, text)`));
      if (b.type === 'compare' && Array.isArray(b.items)) { need(b.items.length >= 2 && b.items.length <= 4, `${bw}: compare attend 2 à 4 cartes`); b.items.forEach((it, k) => need(it.title && Array.isArray(it.points) && it.points.length, `${bw}: carte ${k} incomplète (title, points)`)); }
      if (b.type === 'diagram' && typeof b.svg === 'string') need(/^\s*<svg[\s>]/.test(b.svg) && /viewBox=/.test(b.svg) && !/<script/i.test(b.svg), `${bw}: svg invalide (balise <svg> avec viewBox, sans script)`);
    });
  });
  need(Array.isArray(c.key_numbers) && c.key_numbers.length >= 8, 'key_numbers : au moins 8');
  (c.key_numbers || []).forEach((k, i) => need(k.value && k.label, `key_numbers[${i}] incomplet`));
  need(Array.isArray(c.glossary) && c.glossary.length >= 10, 'glossary : au moins 10 termes');
  (c.glossary || []).forEach((g, i) => need(g.term && g.def, `glossary[${i}] incomplet`));
  need(Array.isArray(c.self_test) && c.self_test.length >= 8, 'self_test : au moins 8 questions');
  (c.self_test || []).forEach((t, i) => need(t.q && t.a, `self_test[${i}] incomplet`));
  return p.map((m) => `${file}${file ? ': ' : ''}${m}`);
}

function loadChapters() {
  const list = ONLY ? [ONLY] : UNITS;
  const out = [];
  for (const u of list) {
    const f = path.join(CH_DIR, `${u}.json`);
    if (!fs.existsSync(f)) { if (ONLY || args.includes('--check')) console.error(`✗ ${u}.json absent`); continue; }
    let c;
    try { c = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { console.error(`✗ ${u}.json : JSON invalide (${e.message})`); process.exitCode = 1; continue; }
    const probs = checkChapter(c, `${u}.json`);
    if (probs.length) { console.error(`✗ ${probs.join('\n✗ ')}`); process.exitCode = 1; }
    out.push(c);
  }
  return out;
}

// ───────────────────────── rendu HTML ─────────────────────────
const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Mise en forme légère : **gras**, *italique*, `code`, retours à la ligne.
function md(s) {
  return esc(s)
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[\s(«])\*([^*\s][^*]*?)\*(?=[\s.,;:!?)»]|$)/g, '$1<em>$2</em>')
    .replace(/\n/g, '<br>');
}

const ICONS = {
  key: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 20.9l1.6-7L2 9.2l7.1-.6z"/></svg>',
  trap: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2L1 21h22L12 2zm0 6l1 7h-2l1-7zm0 9.2a1.3 1.3 0 110 2.6 1.3 1.3 0 010-2.6z"/></svg>',
  memo: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a7 7 0 00-4 12.7V18h8v-3.3A7 7 0 0012 2zm-3 18h6v2H9z"/></svg>',
  example: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 3h16v18H4zM7 7h10v2H7zm0 4h10v2H7zm0 4h6v2H7z"/></svg>',
  formula: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v3h-2V6H9.5l4 6-4 6H17v-1h2v3H5v-1.5L10 12 5 5.5z"/></svg>',
};

function block(b) {
  switch (b.type) {
    case 'text': return `<p>${md(b.text)}</p>`;
    case 'bullets': return `${b.title ? `<p class="list-title">${md(b.title)}</p>` : ''}<ul>${b.items.map((i) => `<li>${md(i)}</li>`).join('')}</ul>`;
    case 'steps': return `${b.title ? `<p class="list-title">${md(b.title)}</p>` : ''}<ol class="steps">${b.items.map((i) => `<li>${md(i)}</li>`).join('')}</ol>`;
    case 'table': return `<figure class="tbl">${b.caption ? `<figcaption>${md(b.caption)}</figcaption>` : ''}<table><thead><tr>${b.columns.map((c) => `<th>${md(c)}</th>`).join('')}</tr></thead><tbody>${b.rows.map((r) => `<tr>${r.map((c) => `<td>${md(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>${b.note ? `<p class="note">${md(b.note)}</p>` : ''}</figure>`;
    case 'formula': return `<div class="box formula"><div class="box-head">${ICONS.formula}<span>${md(b.label)}</span></div><div class="f">${md(b.formula)}</div>${b.example ? `<div class="f-ex"><b>Exemple :</b> ${md(b.example)}</div>` : ''}</div>`;
    case 'key': return `<div class="box key"><div class="box-head">${ICONS.key}<span>${md(b.title || 'À retenir')}</span></div><p>${md(b.text)}</p></div>`;
    case 'trap': return `<div class="box trap"><div class="box-head">${ICONS.trap}<span>${md(b.title || 'Piège classique')}</span></div><p>${md(b.text)}</p></div>`;
    case 'memo': return `<div class="box memo"><div class="box-head">${ICONS.memo}<span>${md(b.title || 'Astuce pour retenir')}</span></div><p>${md(b.text)}</p></div>`;
    case 'example': return `<div class="box example"><div class="box-head">${ICONS.example}<span>${md(b.title || 'Exemple')}</span></div><p>${md(b.text)}</p></div>`;
    case 'code': return `<div class="code">${b.label ? `<div class="code-label">${md(b.label)}</div>` : ''}<pre>${esc(b.text)}</pre>${b.decode ? `<div class="code-decode">${md(b.decode)}</div>` : ''}</div>`;
    case 'dialog': return `<div class="dialog">${b.title ? `<div class="code-label">${md(b.title)}</div>` : ''}${b.lines.map((l) => `<div class="line"><span class="who">${esc(l.who)}</span><span class="said">${md(l.text)}</span></div>`).join('')}</div>`;
    case 'diagram': return `<figure class="diagram">${b.title ? `<figcaption>${md(b.title)}</figcaption>` : ''}${b.svg}${b.caption ? `<p class="note">${md(b.caption)}</p>` : ''}</figure>`;
    case 'compare': return `<div class="compare n${b.items.length}">${b.items.map((it) => `<div class="cmp"><div class="cmp-title">${md(it.title)}</div><ul>${it.points.map((p) => `<li>${md(p)}</li>`).join('')}</ul></div>`).join('')}</div>`;
    default: return '';
  }
}

const num = (c) => Number(c.unit.slice(1));

function chapterHtml(c) {
  const n = num(c);
  return `<section class="chapter" id="ch-${c.unit}" style="--c:${COLORS[c.unit]}" data-page="ch${n}">
  <header class="opener">
    <span class="marker">⟦CH-${c.unit}⟧</span>
    <div class="opener-num">${n}</div>
    <div class="opener-text">
      <div class="eyebrow">Matière ${n} sur 9 · Examen : ${c.exam.questions} questions en ${c.exam.minutes} min · 75 % requis</div>
      <h1>${esc(c.title)}</h1>
      <p class="pitch">${md(c.pitch)}</p>
    </div>
  </header>
  <div class="essentials">
    <h2 class="ess-title">Si tu ne retiens que ça</h2>
    <ol>${c.essentials.map((e) => `<li>${md(e)}</li>`).join('')}</ol>
  </div>
  ${c.sections.map((s, i) => `<section class="sec">
    <h2><span class="marker">⟦S-${c.unit}-${i}⟧</span><span class="sec-num">${n}.${i + 1}</span> ${esc(s.title)}</h2>
    ${s.summary ? `<p class="sec-sum">${md(s.summary)}</p>` : ''}
    ${s.blocks.map(block).join('\n')}
  </section>`).join('\n')}
  <section class="sec recap">
    <h2><span class="sec-num">${n}.★</span> Fiche réflexe : les chiffres à connaître</h2>
    <div class="kn">${c.key_numbers.map((k) => `<div class="kn-row"><span class="kn-v">${md(k.value)}</span><span class="kn-l">${md(k.label)}</span></div>`).join('')}</div>
  </section>
  <section class="sec glossary">
    <h2><span class="sec-num">${n}.★</span> Lexique</h2>
    <dl>${c.glossary.map((g) => `<div><dt>${md(g.term)}</dt><dd>${md(g.def)}</dd></div>`).join('')}</dl>
  </section>
  <section class="sec selftest">
    <h2><span class="sec-num">${n}.★</span> Teste-toi en 2 minutes</h2>
    <ol class="st-q">${c.self_test.map((t) => `<li>${md(t.q)}</li>`).join('')}</ol>
    <div class="st-a"><div class="st-a-title">Réponses</div><ol>${c.self_test.map((t) => `<li>${md(t.a)}</li>`).join('')}</ol></div>
  </section>
</section>`;
}

function compassRose() {
  // Rose des vents façon carte VAC : graduations tous les 5°, chiffres tous les 30°.
  const cx = 150, cy = 150, r = 120;
  let ticks = '';
  for (let d = 0; d < 360; d += 5) {
    const a = (d - 90) * Math.PI / 180, len = d % 30 === 0 ? 16 : d % 10 === 0 ? 10 : 6;
    ticks += `<line x1="${(cx + Math.cos(a) * r).toFixed(1)}" y1="${(cy + Math.sin(a) * r).toFixed(1)}" x2="${(cx + Math.cos(a) * (r - len)).toFixed(1)}" y2="${(cy + Math.sin(a) * (r - len)).toFixed(1)}" stroke-width="${d % 30 === 0 ? 1.6 : 0.8}"/>`;
    if (d % 30 === 0) {
      const lbl = { 0: 'N', 90: 'E', 180: 'S', 270: 'W' }[d] ?? String(d / 10).padStart(2, '0');
      ticks += `<text x="${(cx + Math.cos(a) * (r - 30)).toFixed(1)}" y="${(cy + Math.sin(a) * (r - 30) + 5).toFixed(1)}">${lbl}</text>`;
    }
  }
  return `<svg class="rose" viewBox="0 0 300 300" aria-hidden="true"><g stroke="currentColor" fill="none"><circle cx="${cx}" cy="${cy}" r="${r}" stroke-width="1.4"/><circle cx="${cx}" cy="${cy}" r="${r - 48}" stroke-width="0.6" stroke-dasharray="2 3"/>${ticks.replace(/<text/g, '<text fill="currentColor" stroke="none"')}</g><path d="M150 40 L158 150 L150 140 L142 150 Z" fill="currentColor"/><circle cx="150" cy="150" r="3" fill="currentColor"/></svg>`;
}

function frontHtml(chapters, toc) {
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  const course = JSON.parse(fs.readFileSync(COURSE, 'utf8'));
  const subjects = course.exam.subjects;
  const totalQ = subjects.reduce((s, x) => s + x.questions, 0);
  const totalMin = subjects.reduce((s, x) => s + x.minutes, 0);
  const pg = (id) => (toc && toc[id] ? toc[id] : '00');
  return `
<section class="cover" data-page="cover">
  <div class="cover-top">
    <div class="cover-kicker">Théorique avion · Programme DGAC en vigueur depuis le 4 décembre 2023</div>
    <h1 class="cover-title">Mémento<br>LAPL(A) / PPL(A)</h1>
    <p class="cover-sub">Les 9 matières de l'examen théorique, résumées pour réviser vite et bien : l'essentiel, les chiffres, les pièges et des tests éclair.</p>
  </div>
  ${compassRose()}
  <div class="cover-grid">
    ${subjects.map((s, i) => `<div class="cover-sub-item" style="--c:${COLORS['u' + (i + 1)]}"><b>${i + 1}</b><span>${esc(s.title)}</span><em>${s.questions} q · ${s.minutes} min</em></div>`).join('')}
  </div>
  <p class="cover-foot">${totalQ} questions · ${Math.floor(totalMin / 60)} h ${String(totalMin % 60).padStart(2, '0')} d'épreuves · 75 % exigés dans chaque matière. Document de révision : il ne remplace ni les textes officiels (SERA, Part-FCL, Part-NCO, AIP France) ni ton instructeur.</p>
</section>

<section class="front" data-page="front">
  <h1 class="front-h1"><span class="marker">⟦FRONT⟧</span>Sommaire</h1>
  <div class="toc">
    <div class="toc-row toc-front"><span>Mode d'emploi, l'examen et la méthode</span><i></i><b>${pg('howto')}</b></div>
    ${chapters.map((c) => `<div class="toc-ch" style="--c:${COLORS[c.unit]}">
      <div class="toc-row toc-main"><span><em>${num(c)}</em>${esc(c.title)}</span><i></i><b>${pg(c.unit)}</b></div>
      <div class="toc-secs">${c.sections.map((s, i) => `<div class="toc-row toc-sec"><span>${num(c)}.${i + 1} ${esc(s.title)}</span><i></i><b>${pg(`${c.unit}-${i}`)}</b></div>`).join('')}</div>
    </div>`).join('')}
    <div class="toc-row toc-front"><span>Annexe A · Tous les chiffres à connaître</span><i></i><b>${pg('annexA')}</b></div>
    <div class="toc-row toc-front"><span>Annexe B · Toutes les formules et méthodes de calcul</span><i></i><b>${pg('annexB')}</b></div>
    <div class="toc-row toc-front"><span>Annexe C · La veille et le jour de l'examen</span><i></i><b>${pg('annexC')}</b></div>
  </div>

  <h1 class="front-h1 brk"><span class="marker">⟦HOWTO⟧</span>Mode d'emploi</h1>
  <div class="howto">
    <p>Chaque matière suit le même plan, pour que tu saches toujours où chercher :</p>
    <ol class="howto-list">
      <li><b>Si tu ne retiens que ça</b> : les idées indispensables, à relire la veille de l'examen.</li>
      <li><b>Les chapitres</b> : le cours résumé, avec tableaux, exemples chiffrés et schémas.</li>
      <li><b>La fiche réflexe</b> : tous les chiffres de la matière sur une demi-page.</li>
      <li><b>Le lexique</b> : les termes et abréviations, définis en une ligne.</li>
      <li><b>Teste-toi</b> : 8 à 12 questions éclair, réponses en dessous (cache-les avec la main).</li>
    </ol>
    <p>Les encadrés de couleur ont toujours le même sens :</p>
    <div class="legend">
      ${block({ type: 'key', text: 'Une règle ou une valeur que l\'examen demande presque à coup sûr.' })}
      ${block({ type: 'trap', text: 'La mauvaise réponse qui attire les candidats, et comment l\'éviter.' })}
      ${block({ type: 'memo', text: 'Un moyen mnémotechnique ou une image pour retenir sans effort.' })}
      ${block({ type: 'example', text: 'Un cas concret ou un calcul résolu pas à pas.' })}
    </div>
  </div>

  <h1 class="front-h1 brk">L'examen théorique</h1>
  <figure class="tbl"><table><thead><tr><th>#</th><th>Épreuve</th><th>Questions</th><th>Durée</th></tr></thead><tbody>
    ${subjects.map((s, i) => `<tr><td><span class="dot" style="--c:${COLORS['u' + (i + 1)]}">${i + 1}</span></td><td>${esc(s.title)}</td><td>${s.questions}</td><td>${s.minutes} min</td></tr>`).join('')}
    <tr class="total"><td></td><td>Total</td><td>${totalQ}</td><td>${totalMin} min</td></tr>
  </tbody></table></figure>
  ${block({ type: 'key', title: 'Pour réussir', text: `Il faut **au moins 75 % dans chaque épreuve** : une matière ratée se repasse seule, mais une excellente note ailleurs ne la compense pas. Les questions sont des QCM à 4 choix, une seule bonne réponse.` })}

  <h1 class="front-h1 brk">La méthode</h1>
  <div class="method">
    <p>${md(lib.method || '')}</p>
    ${block({ type: 'steps', title: 'Un plan sur 6 semaines (environ 1 h par jour)', items: [
      '**Semaine 1** : Droit aérien et Communications. Ce sont des règles à apprendre : fais une fiche par chapitre et relis-la le lendemain.',
      '**Semaine 2** : Météorologie. Apprends à décoder un METAR et un TAF en lisant ceux des aérodromes que tu connais (sur Aéroweb).',
      '**Semaine 3** : Navigation et Performances et préparation du vol. Refais chaque calcul de ce mémento avec ton computer ou ta calculette, sans regarder la solution.',
      '**Semaine 4** : Principes du vol, Connaissance de l\'aéronef, Procédures opérationnelles et Performance humaine.',
      '**Semaine 5** : QCM par matière (appli, banques en ligne). Note chaque erreur, puis relis le paragraphe correspondant ici.',
      '**Semaine 6** : examens blancs complets, en temps réel. Vise 85 % partout pour garder une marge le jour J.',
    ] })}
    ${block({ type: 'memo', title: 'Réviser efficacement', text: 'Teste-toi plutôt que de relire : une question ratée puis comprise s\'oublie beaucoup moins qu\'une page relue. Reviens sur une matière 1 jour, 3 jours puis 7 jours après l\'avoir étudiée.' })}
  </div>
  <h2 class="front-h2">Ma checklist de préparation</h2>
  <ul class="checklist">${(lib.checklist || []).map((c) => `<li><span class="cb"></span>${md(c.label)}</li>`).join('')}</ul>
</section>`;
}

function annexHtml(chapters) {
  const formulas = [];
  for (const c of chapters) c.sections.forEach((s) => s.blocks.forEach((b) => { if (b.type === 'formula') formulas.push({ c, s, b }); }));
  const lib = JSON.parse(fs.readFileSync(LIB, 'utf8'));
  const picks = ['dgac-format', 'dgac-sera', 'sia', 'aeroweb', 'dgac-phraseo', 'meteofrance-guide', 'ffa-memo-vfr', 'easa-aircrew'];
  const items = lib.sections.flatMap((s) => s.items || []);
  const res = picks.map((id) => items.find((i) => i.id === id)).filter((i) => i && i.url);
  return `<section class="annex" data-page="annex">
  <h1 class="front-h1"><span class="marker">⟦ANNEXA⟧</span>Annexe A · Tous les chiffres à connaître</h1>
  <p class="lead">La fiche réflexe de chaque matière, réunie au même endroit. Lis une ligne, cache la valeur, récite-la.</p>
  ${chapters.map((c) => `<div class="annex-block" style="--c:${COLORS[c.unit]}"><h3><span class="dot">${num(c)}</span>${esc(c.title)}</h3><div class="kn">${c.key_numbers.map((k) => `<div class="kn-row"><span class="kn-v">${md(k.value)}</span><span class="kn-l">${md(k.label)}</span></div>`).join('')}</div></div>`).join('')}

  <h1 class="front-h1 brk"><span class="marker">⟦ANNEXB⟧</span>Annexe B · Toutes les formules et méthodes de calcul</h1>
  <p class="lead">Les calculs de l'examen se font à la main ou au computer, sans calculatrice programmable : entraîne-toi sur chaque exemple.</p>
  <div class="formulas">${formulas.map(({ c, b }) => `<div class="fx" style="--c:${COLORS[c.unit]}"><div class="fx-src">${num(c)} · ${esc(c.title)}</div><div class="fx-l">${md(b.label)}</div><div class="f">${md(b.formula)}</div>${b.example ? `<div class="f-ex"><b>Exemple :</b> ${md(b.example)}</div>` : ''}</div>`).join('')}</div>

  <h1 class="front-h1 brk"><span class="marker">⟦ANNEXC⟧</span>Annexe C · La veille et le jour de l'examen</h1>
  ${block({ type: 'steps', title: 'La veille', items: [
    'Relis uniquement les pages « Si tu ne retiens que ça » et l\'annexe A. N\'attaque pas de nouveau chapitre.',
    'Prépare ta pièce d\'identité, ta convocation et le matériel autorisé par ta convocation (règle, rapporteur, computer de navigation, calculatrice non programmable).',
    'Dors : la fatigue coûte plus de points qu\'une heure de révision ne t\'en rapporte (voir Performance humaine).',
  ] })}
  ${block({ type: 'steps', title: 'Pendant l\'épreuve', items: [
    'Lis l\'énoncé jusqu\'au bout et repère les mots qui changent tout : « sauf », « minimum », « en France », « de nuit », « au-dessus du sol ».',
    'Élimine d\'abord les réponses fausses : il en reste souvent deux, et l\'énoncé dit laquelle est juste.',
    'Fais les calculs sur le brouillon, unités écrites ; vérifie l\'ordre de grandeur avant de cocher.',
    'Ne reste pas bloqué : marque la question, avance, reviens à la fin. Ne laisse aucune case vide.',
    'Surveille l\'horloge : environ 1 min 30 par question (2 min 30 en navigation).',
  ] })}
  <h2 class="front-h2">Les sources officielles à garder sous la main</h2>
  <ul class="res">${res.map((r) => `<li><b>${esc(r.title)}</b><br><span>${esc(r.url)}</span></li>`).join('')}</ul>
  <p class="disclaimer">Ce mémento résume le programme pour la révision. En cas de doute ou de différence, c'est le texte officiel en vigueur qui fait foi : SERA (règlement (UE) n° 923/2012), Part-FCL et Part-MED (règlement (UE) n° 1178/2011), Part-NCO (règlement (UE) n° 965/2012) et l'AIP France publiée par le SIA.</p>
</section>`;
}

function css(chapters) {
  const ch = chapters.map((c) => `@page ch${num(c)} { @top-right { content: "${num(c)} · ${c.title.replace(/"/g, '\\"')}"; color: ${COLORS[c.unit]}; } }`).join('\n');
  return `
@font-face { font-family: 'Barlow Condensed'; font-weight: 500; src: url('${FONT_DIR}/barlow-condensed-latin-500-normal.woff2') format('woff2'); }
@font-face { font-family: 'Barlow Condensed'; font-weight: 600; src: url('${FONT_DIR}/barlow-condensed-latin-600-normal.woff2') format('woff2'); }
@font-face { font-family: 'Barlow Condensed'; font-weight: 700; src: url('${FONT_DIR}/barlow-condensed-latin-700-normal.woff2') format('woff2'); }
@font-face { font-family: 'Barlow Condensed'; font-weight: 800; src: url('${FONT_DIR}/barlow-condensed-latin-800-normal.woff2') format('woff2'); }
@font-face { font-family: 'InterWeb'; font-weight: 400; src: url('${FONT_DIR}/inter-latin-400-normal.woff2') format('woff2'), url('${FONT_DIR}/inter-latin-ext-400-normal.woff2') format('woff2'); }
@font-face { font-family: 'InterWeb'; font-weight: 400; font-style: italic; src: url('${FONT_DIR}/inter-latin-400-italic.woff2') format('woff2'); }
@font-face { font-family: 'InterWeb'; font-weight: 500; src: url('${FONT_DIR}/inter-latin-500-normal.woff2') format('woff2'); }
@font-face { font-family: 'InterWeb'; font-weight: 600; src: url('${FONT_DIR}/inter-latin-600-normal.woff2') format('woff2'); }
@font-face { font-family: 'InterWeb'; font-weight: 700; src: url('${FONT_DIR}/inter-latin-700-normal.woff2') format('woff2'); }
@font-face { font-family: 'MonoWeb'; font-weight: 400; src: url('${FONT_DIR}/jetbrains-mono-latin-400-normal.woff2') format('woff2'); }
@font-face { font-family: 'MonoWeb'; font-weight: 600; src: url('${FONT_DIR}/jetbrains-mono-latin-600-normal.woff2') format('woff2'); }

/* Planche de vol : encre marine, magenta des cartes VAC, ciel ; une couleur par matière. */
:root {
  --ink: #14213d; --ink-2: #3d4a66; --muted: #6b7489; --rule: #d6dbe6; --paper: #ffffff; --wash: #f3f5f9;
  --vac: #b0177a; --sky: #2b7a9b;
  --key-bg: #e8f0fb; --key-fg: #1d4e89; --trap-bg: #fdeee6; --trap-fg: #b3401a; --memo-bg: #eaf6ee; --memo-fg: #2e7d4f; --ex-bg: #f5f1fa; --ex-fg: #5b3f8c;
  --display: 'Barlow Condensed', 'Arial Narrow', sans-serif; --body: 'Inter', 'InterWeb', 'DejaVu Sans', sans-serif; --mono: 'JetBrains Mono', 'MonoWeb', 'DejaVu Sans Mono', monospace;
}
@page { size: A4; margin: 17mm 15mm 15mm 15mm;
  @top-left { content: "Mémento LAPL(A) / PPL(A)"; font: 600 8pt 'Barlow Condensed', sans-serif; letter-spacing: .08em; text-transform: uppercase; color: #6b7489; vertical-align: bottom; padding-bottom: 3mm; }
  @top-right { font: 700 9pt 'Barlow Condensed', sans-serif; letter-spacing: .04em; text-transform: uppercase; vertical-align: bottom; padding-bottom: 3mm; }
  @bottom-right { content: counter(page); font: 600 9pt 'Inter', sans-serif; color: #14213d; vertical-align: top; padding-top: 3mm; }
  @bottom-left { content: "Révision · ne remplace pas les textes officiels"; font: 400 7pt 'Inter', sans-serif; color: #9aa2b4; vertical-align: top; padding-top: 3.4mm; }
}
@page cover { margin: 0; @top-left { content: none } @top-right { content: none } @bottom-right { content: none } @bottom-left { content: none } }
@page front { @top-right { content: "Avant de commencer"; color: #b0177a; } }
@page annex { @top-right { content: "Annexes"; color: #b0177a; } }
${ch}
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font: 400 9.4pt/1.47 var(--body); color: var(--ink); background: var(--paper); hyphens: auto; font-variant-numeric: tabular-nums; }
.marker { position: absolute; font-size: 1px; color: transparent; }
p { margin: 0 0 2.2mm; orphans: 3; widows: 3; }
strong { font-weight: 700; color: var(--ink); }
code { font: 500 8.6pt var(--mono); background: var(--wash); padding: 0 1mm; border-radius: 1mm; }
ul, ol { margin: 0 0 2.6mm; padding-left: 5mm; }
li { margin: 0 0 1mm; }
li::marker { color: var(--c, var(--vac)); font-weight: 700; }
h1, h2, h3 { font-family: var(--display); color: var(--ink); text-wrap: balance; }

/* Couverture */
.cover { page: cover; height: 297mm; padding: 22mm 18mm 16mm; background: var(--ink); color: #fff; position: relative; overflow: hidden; display: flex; flex-direction: column; break-after: page; }
.cover-kicker { font: 600 10pt var(--display); letter-spacing: .14em; text-transform: uppercase; color: #f4a6d7; }
.cover-title { color: #fff; font-size: 54pt; line-height: .95; font-weight: 800; margin: 6mm 0 5mm; letter-spacing: -.01em; }
.cover-sub { font-size: 12pt; line-height: 1.45; max-width: 128mm; color: #d7deec; }
.cover .rose { position: absolute; right: -38mm; top: 70mm; width: 150mm; color: rgba(255,255,255,.22); }
.cover-grid { margin-top: auto; display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm; position: relative; }
.cover-sub-item { border-top: 1.2mm solid var(--c); background: rgba(255,255,255,.06); padding: 2.6mm 3mm 3mm; display: grid; grid-template-columns: auto 1fr; column-gap: 2.4mm; align-items: baseline; }
.cover-sub-item b { font: 800 16pt var(--display); color: #fff; grid-row: span 2; }
.cover-sub-item span { font: 600 11pt/1.1 var(--display); color: #fff; }
.cover-sub-item em { font: 400 8pt var(--body); font-style: normal; color: #aab4c8; }
.cover-foot { margin-top: 7mm; font-size: 8.4pt; color: #aab4c8; max-width: 165mm; }

/* Pages d'introduction et annexes */
.front { page: front; }
.annex { page: annex; break-before: page; }
.front-h1 { font-size: 26pt; font-weight: 800; margin: 0 0 5mm; letter-spacing: -.005em; position: relative; }
.front-h1.brk { break-before: page; }
.front-h2 { font-size: 15pt; font-weight: 700; margin: 6mm 0 3mm; }
.lead { color: var(--ink-2); font-size: 10pt; margin-bottom: 5mm; }
.toc { display: flex; flex-direction: column; gap: 1.2mm; }
.toc-row { display: flex; align-items: baseline; gap: 2mm; }
.toc-row span { min-width: 0; }
.toc-row i { flex: 1; border-bottom: .3mm dotted #b8c0d0; transform: translateY(-1mm); }
.toc-row b { font-weight: 600; min-width: 7mm; text-align: right; }
.toc-front { font: 700 11.5pt var(--display); padding: 1mm 0; }
.toc-ch { border-left: 1.4mm solid var(--c); padding: 1.2mm 0 1.2mm 3mm; break-inside: avoid; }
.toc-main { font: 700 13pt var(--display); color: var(--c); }
.toc-main em { font-style: normal; display: inline-block; min-width: 6mm; }
.toc-main b { color: var(--ink); }
.toc-secs { columns: 2; column-gap: 8mm; margin-top: .6mm; }
.toc-sec { font-size: 8.2pt; color: var(--ink-2); break-inside: avoid; padding: .2mm 0; }
.howto-list li { margin-bottom: 1.6mm; }
.legend { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.legend .box { margin: 0; }
.method p { font-size: 10pt; }
.checklist { list-style: none; padding: 0; display: grid; gap: 2mm; }
.checklist li { display: flex; gap: 3mm; align-items: flex-start; }
.cb { flex: none; width: 4mm; height: 4mm; border: .4mm solid var(--vac); border-radius: .8mm; margin-top: .6mm; }
.res { list-style: none; padding: 0; display: grid; grid-template-columns: 1fr 1fr; gap: 2.5mm 6mm; }
.res li { font-size: 8.6pt; break-inside: avoid; }
.res span { font: 400 7.2pt var(--mono); color: var(--sky); word-break: break-all; }
.disclaimer { margin-top: 6mm; font-size: 8pt; color: var(--muted); border-top: .3mm solid var(--rule); padding-top: 3mm; }
.dot { display: inline-flex; align-items: center; justify-content: center; width: 5.4mm; height: 5.4mm; border-radius: 50%; background: var(--c); color: #fff; font: 700 9pt var(--display); margin-right: 2mm; }
.annex-block { break-inside: avoid-page; margin-bottom: 4mm; }
.annex-block h3 { font-size: 13pt; font-weight: 700; color: var(--c); margin: 0 0 1.6mm; display: flex; align-items: center; }
.formulas { display: grid; grid-template-columns: 1fr 1fr; gap: 3mm; }
.fx { border: .3mm solid var(--rule); border-top: 1mm solid var(--c); border-radius: 1.4mm; padding: 2.4mm 3mm; break-inside: avoid; }
.fx-src { font: 600 7.4pt var(--display); text-transform: uppercase; letter-spacing: .08em; color: var(--c); }
.fx-l { font: 700 11pt var(--display); margin: .4mm 0 1.4mm; }

/* Chapitres */
.chapter { break-before: page; }
${chapters.map((c) => `.chapter[data-page="ch${num(c)}"] { page: ch${num(c)}; }`).join('\n')}
.opener { position: relative; display: grid; grid-template-columns: 22mm 1fr; gap: 5mm; background: var(--c); color: #fff; margin: 0 0 5mm; padding: 6mm 7mm 6mm 6mm; border-radius: 2mm; }
.opener-num { font: 800 54pt/0.85 var(--display); color: rgba(255,255,255,.92); }
.opener .eyebrow { font: 600 8.6pt var(--display); letter-spacing: .1em; text-transform: uppercase; color: rgba(255,255,255,.8); }
.opener h1 { color: #fff; font-size: 30pt; line-height: 1; margin: 1.4mm 0 2.6mm; font-weight: 800; }
.opener .pitch { color: rgba(255,255,255,.93); font-size: 10pt; margin: 0; }
.essentials { border: .5mm solid var(--c); border-radius: 2mm; padding: 4mm 5mm 2mm; margin-bottom: 6mm; break-inside: avoid; }
.ess-title { font-size: 15pt; font-weight: 800; color: var(--c); margin: 0 0 2.4mm; text-transform: uppercase; letter-spacing: .02em; }
.essentials ol { padding-left: 6mm; }
.essentials li { margin-bottom: 1.6mm; font-size: 9.6pt; }
.sec { margin-bottom: 4mm; }
.sec > h2 { font-size: 17pt; font-weight: 700; margin: 5mm 0 1.6mm; color: var(--ink); break-after: avoid; position: relative; border-bottom: .5mm solid var(--c); padding-bottom: 1mm; }
.sec-num { color: var(--c); margin-right: 1.6mm; }
.sec-sum { font-size: 10pt; color: var(--ink-2); font-style: italic; margin-bottom: 3mm; break-after: avoid; }
.list-title { font-weight: 700; margin-bottom: 1mm; break-after: avoid; }
ol.steps { counter-reset: st; list-style: none; padding-left: 0; }
ol.steps > li { counter-increment: st; position: relative; padding-left: 8mm; margin-bottom: 1.6mm; }
ol.steps > li::before { content: counter(st); position: absolute; left: 0; top: .2mm; width: 5mm; height: 5mm; border-radius: 50%; background: var(--c, var(--vac)); color: #fff; font: 700 8pt/5mm var(--display); text-align: center; }

.box { border-radius: 1.6mm; padding: 2.4mm 3.4mm 1mm; margin: 0 0 3mm; break-inside: avoid; }
.box-head { display: flex; align-items: center; gap: 1.6mm; font: 700 9.6pt var(--display); text-transform: uppercase; letter-spacing: .06em; margin-bottom: 1mm; }
.box-head svg { width: 3.6mm; height: 3.6mm; fill: currentColor; flex: none; }
.box.key { background: var(--key-bg); } .box.key .box-head { color: var(--key-fg); }
.box.trap { background: var(--trap-bg); } .box.trap .box-head { color: var(--trap-fg); }
.box.memo { background: var(--memo-bg); } .box.memo .box-head { color: var(--memo-fg); }
.box.example { background: var(--ex-bg); } .box.example .box-head { color: var(--ex-fg); }
.box.formula { background: var(--wash); border-left: 1mm solid var(--c, var(--vac)); }
.box.formula .box-head { color: var(--c, var(--vac)); }
.f { font: 600 10.4pt/1.45 var(--mono); color: var(--ink); margin: .6mm 0 1.6mm; }
.f-ex { font-size: 8.8pt; color: var(--ink-2); margin-bottom: 1.4mm; }

figure { margin: 0 0 3.4mm; }
.tbl { break-inside: avoid; }
figcaption { font: 700 10.4pt var(--display); margin-bottom: 1.4mm; color: var(--ink); }
table { width: 100%; border-collapse: collapse; font-size: 8.6pt; line-height: 1.35; }
th { background: var(--ink); color: #fff; font: 600 8.8pt var(--display); text-transform: uppercase; letter-spacing: .05em; text-align: left; padding: 1.6mm 2mm; }
.chapter th { background: var(--c); }
td { padding: 1.4mm 2mm; border-bottom: .25mm solid var(--rule); vertical-align: top; }
tbody tr:nth-child(even) td { background: #f8f9fc; }
tr.total td { font-weight: 700; border-top: .4mm solid var(--ink); }
.note { font-size: 8pt; color: var(--muted); margin-top: 1.2mm; }

.code { background: #10192e; color: #e6ecf7; border-radius: 1.6mm; padding: 2.4mm 3.4mm; margin: 0 0 3mm; break-inside: avoid; }
.code-label { font: 700 8.6pt var(--display); text-transform: uppercase; letter-spacing: .08em; color: #f4a6d7; margin-bottom: 1mm; }
.dialog .code-label { color: var(--vac); }
.code pre { margin: 0; font: 500 9pt/1.5 var(--mono); white-space: pre-wrap; word-break: break-word; }
.code-decode { margin-top: 1.6mm; font-size: 8.6pt; color: #c3cde0; border-top: .25mm solid rgba(255,255,255,.15); padding-top: 1.6mm; }
.code-decode strong { color: #fff; }
.code-decode code { background: rgba(255,255,255,.1); color: #fff; }
.dialog { border: .3mm solid var(--rule); border-radius: 1.6mm; padding: 2.4mm 3.4mm; margin: 0 0 3mm; break-inside: avoid; }
.dialog .line { display: grid; grid-template-columns: 24mm 1fr; gap: 2mm; padding: .8mm 0; border-bottom: .2mm dashed var(--rule); }
.dialog .line:last-child { border-bottom: 0; }
.who { font: 700 8.6pt var(--display); text-transform: uppercase; letter-spacing: .05em; color: var(--c, var(--vac)); }
.said { font: 500 8.8pt var(--mono); }
.diagram { break-inside: avoid; text-align: center; }
.diagram svg { width: 100%; max-width: 100%; max-height: 95mm; height: auto; font-family: 'Inter', 'InterWeb', sans-serif; }
.diagram figcaption { text-align: left; }
.diagram .note { text-align: left; }
.compare { display: grid; gap: 3mm; margin: 0 0 3.4mm; break-inside: avoid; }
.compare.n2 { grid-template-columns: 1fr 1fr; } .compare.n3 { grid-template-columns: repeat(3, 1fr); } .compare.n4 { grid-template-columns: 1fr 1fr; }
.cmp { border: .3mm solid var(--rule); border-top: 1.2mm solid var(--c, var(--vac)); border-radius: 1.4mm; padding: 2.4mm 3mm 1mm; }
.cmp-title { font: 700 11.4pt var(--display); margin-bottom: 1.2mm; }
.cmp ul { padding-left: 4mm; font-size: 8.8pt; }

.kn { columns: 2; column-gap: 7mm; }
.kn-row { display: grid; grid-template-columns: 27mm 1fr; gap: 2mm; padding: 1mm 0; border-bottom: .25mm solid var(--rule); break-inside: avoid; font-size: 8.6pt; }
.kn-v { font: 700 9pt var(--mono); color: var(--c, var(--ink)); }
.glossary dl { columns: 2; column-gap: 7mm; margin: 0; }
.glossary dl > div { break-inside: avoid; padding: .9mm 0; border-bottom: .25mm solid var(--rule); font-size: 8.5pt; }
.glossary dt { display: inline; font-weight: 700; color: var(--c); }
.glossary dt::after { content: " : "; color: var(--muted); font-weight: 400; }
.glossary dd { display: inline; margin: 0; }
.selftest .st-q li { margin-bottom: 1.6mm; }
.st-a { margin-top: 3mm; background: var(--wash); border-radius: 1.6mm; padding: 2.4mm 3.4mm 1mm; font-size: 8.4pt; color: var(--ink-2); break-inside: avoid; }
.st-a-title { font: 700 9pt var(--display); text-transform: uppercase; letter-spacing: .08em; margin-bottom: 1mm; color: var(--muted); }
`;
}

function pageHtml(chapters, toc, onlyChapter) {
  const body = onlyChapter ? chapters.map(chapterHtml).join('\n') : `${frontHtml(chapters, toc)}\n${chapters.map(chapterHtml).join('\n')}\n${annexHtml(chapters)}`;
  return `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>Mémento LAPL(A) / PPL(A)</title><style>${css(chapters)}</style></head><body>${body}</body></html>`;
}

// ───────────────────────── PDF ─────────────────────────
async function render(html, out) {
  const req = createRequire(import.meta.url);
  let pw;
  try { pw = req('playwright'); } catch { pw = req('/opt/node22/lib/node_modules/playwright'); }
  const browser = await pw.chromium.launch();
  const page = await browser.newPage();
  const tmp = path.join(path.dirname(out), `.${path.basename(out)}.html`);
  fs.writeFileSync(tmp, html);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({ path: out, preferCSSPageSize: true, printBackground: true, outline: true, tagged: true });
  await browser.close();
  fs.unlinkSync(tmp);
}

function markers(pdf) {
  const txt = execFileSync('pdftotext', ['-enc', 'UTF-8', pdf, '-'], { maxBuffer: 64 << 20 }).toString('utf8');
  const pages = txt.split('\f');
  const map = {};
  pages.forEach((t, i) => {
    for (const m of t.matchAll(/⟦(CH|S)-(u\d)(?:-(\d+))?⟧/g)) { const id = m[1] === 'CH' ? m[2] : `${m[2]}-${m[3]}`; map[id] ??= i + 1; }
    for (const m of t.matchAll(/⟦(HOWTO|ANNEXA|ANNEXB|ANNEXC)⟧/g)) { const id = { HOWTO: 'howto', ANNEXA: 'annexA', ANNEXB: 'annexB', ANNEXC: 'annexC' }[m[1]]; map[id] ??= i + 1; }
  });
  return { map, pages: pages.length - (pages.at(-1).trim() ? 0 : 1) };
}

const chapters = loadChapters();
if (args.includes('--check')) {
  console.log(process.exitCode ? 'Des erreurs sont à corriger.' : `✓ ${chapters.length} chapitre(s) valides`);
  process.exit(process.exitCode || 0);
}
if (!chapters.length) { console.error('Aucun chapitre à rendre.'); process.exit(1); }

if (ONLY) {
  const out = path.resolve(typeof PNG === 'string' ? PNG : HERE, `apercu-${ONLY}.pdf`);
  if (typeof PNG === 'string') fs.mkdirSync(PNG, { recursive: true });
  await render(pageHtml(chapters, null, true), out);
  const { pages } = markers(out);
  console.log(`Aperçu : ${out} (${pages} pages)`);
  if (typeof PNG === 'string') {
    for (const f of fs.readdirSync(PNG)) if (/^page-\d+\.png$/.test(f)) fs.unlinkSync(path.join(PNG, f));
    execFileSync('pdftoppm', ['-png', '-r', '70', out, path.join(PNG, 'page')]);
    console.log(`Pages PNG : ${fs.readdirSync(PNG).filter((f) => f.endsWith('.png')).sort().map((f) => path.join(PNG, f)).join('\n')}`);
  }
} else {
  await render(pageHtml(chapters, null), OUT);
  const first = markers(OUT);
  await render(pageHtml(chapters, first.map), OUT);
  const second = markers(OUT);
  const moved = Object.keys(first.map).filter((k) => first.map[k] !== second.map[k]);
  if (moved.length) { await render(pageHtml(chapters, second.map), OUT); }
  console.log(`✓ ${OUT} : ${second.pages} pages, ${chapters.length} matières`);
}
