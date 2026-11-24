/**
 * Rend les schémas (figures SVG) d'un fichier de cours en PNG pour les vérifier à l'œil.
 * Usage : node scripts/preview-figures.mjs lapl.part3.json /tmp/apercu [u3s2]
 * Chaque figure est rendue à 720 px de large (taille d'une fiche sur ordinateur) puis à 360 px (téléphone).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const [file, out, only] = process.argv.slice(2);
if (!file || !out) { console.error('Usage : node scripts/preview-figures.mjs <fichier.json> <dossier> [idLeçon]'); process.exit(1); }
const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/data/courses');
const c = JSON.parse(fs.readFileSync(path.join(dir, path.basename(file)), 'utf8'));
fs.mkdirSync(out, { recursive: true });
const req = createRequire(import.meta.url);
let pw; try { pw = req('playwright'); } catch { pw = req('/opt/node22/lib/node_modules/playwright'); }
const browser = await pw.chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 600 } });
let n = 0;
for (const u of c.units || []) for (const s of u.skills || []) {
  if (only && s.id !== only) continue;
  for (const [k, f] of (s.figures || []).entries()) {
    if (!f.svg) continue;
    for (const w of [720, 360]) {
      await page.setContent(`<!doctype html><html><body style="margin:0;padding:16px;background:#fff;font-family:Inter,system-ui,sans-serif;color:#14213d"><figure style="margin:0;width:${w}px"><figcaption style="font:700 16px sans-serif;margin-bottom:8px">${f.title}</figcaption><div style="width:100%">${f.svg.replace('<svg', '<svg style="width:100%;height:auto;display:block"')}</div><p style="font-size:13px;color:#46516a">${f.caption || ''}</p></figure></body></html>`);
      const el = await page.$('figure');
      const p = path.join(out, `${s.id}-fig${k + 1}-${w}.png`);
      await el.screenshot({ path: p });
      console.log(p); n++;
    }
  }
}
await browser.close();
if (!n) console.log('Aucune figure SVG à rendre.');
