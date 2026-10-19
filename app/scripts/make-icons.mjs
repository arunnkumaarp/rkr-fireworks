// Draws the RKR app icon, Android adaptive layers, splash mark and favicon from one SVG mark,
// and renders them to PNG in headless Chrome.  Run from app/: node scripts/make-icons.mjs
//
// The mark is a flowerpot (anar) fountain, the cracker on the shop's hero photo: gold sparks
// rising from a small pot and falling away in arcs. Flat colours from the night theme, no gradients.
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Browser } from '../../.claude/skills/design-taste-frontend/scripts/lib/cdp.mjs';

const OUT = fileURLToPath(new URL('../assets/images/', import.meta.url));
const FONT = fileURLToPath(new URL('../assets/fonts/Gambarino-Regular.ttf', import.meta.url));
const NIGHT = '#0F0D0C';
const GOLD = '#F2B544';
const GOLD_DEEP = '#C4861C';
const GOLD_LIGHT = '#FFE2A3';

// Deterministic jitter so the icon is the same on every run.
let seed = 7;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

/** Spark trajectories: parabolas from the pot's mouth, fanned around vertical. */
function sparks({ cx, base, scale, color }) {
  const paths = [];
  const n = 17;
  for (let i = 0; i < n; i++) {
    const a = (-1 + (2 * i) / (n - 1)) * 0.58 + (rand() - 0.5) * 0.04; // radians from vertical
    const v = (1 - Math.abs(a) * 0.3) * (0.94 + rand() * 0.1);
    const pts = [];
    for (let t = 0; t <= 3; t += 0.03) {
      const x = Math.sin(a) * v * t * 0.85;
      const y = Math.cos(a) * v * t - 0.24 * t * t;
      if (t > 0.4 && y < 0.04) break;
      pts.push([cx + x * scale, base - y * scale]);
    }
    const d = pts.map((p, k) => `${k ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
    const tone = color ?? (i % 4 === 1 ? GOLD_LIGHT : i % 3 === 0 ? GOLD_DEEP : GOLD);
    const w = (Math.abs(a) < 0.2 ? 17 : 13) * (scale / 560);
    paths.push(`<path d="${d}" fill="none" stroke="${tone}" stroke-width="${w.toFixed(1)}" stroke-linecap="round" stroke-linejoin="round"/>`);
    const end = pts[pts.length - 1];
    paths.push(`<circle cx="${end[0].toFixed(1)}" cy="${end[1].toFixed(1)}" r="${(w * 1.25).toFixed(1)}" fill="${tone}"/>`);
  }
  return paths.join('');
}

/** The pot: a short cone with a lip, sitting on the base line. */
function pot({ cx, base, scale, color }) {
  const s = scale / 560;
  const top = base - 6 * s;
  const w1 = 26 * s; // mouth half-width
  const w2 = 50 * s; // foot half-width
  const h = 78 * s;
  return `<path d="M${cx - w1},${top} L${cx + w1},${top} L${cx + w2},${top + h} L${cx - w2},${top + h} Z" fill="${color ?? GOLD}"/>`
    + `<rect x="${cx - w1 - 8 * s}" y="${top - 10 * s}" width="${2 * (w1 + 8 * s)}" height="${14 * s}" rx="${4 * s}" fill="${color ?? GOLD}"/>`;
}

function mark({ cx = 512, base = 640, scale = 560, color } = {}) {
  seed = 7;
  return sparks({ cx, base, scale, color }) + pot({ cx, base, scale, color });
}

/** Wraps a drawing so the page script centres it at (cx, cy) and scales its larger side to `size` px,
 *  or with by = 'h' its height, letting the outer sparks run past the edge. */
const fit = (body, cx, cy, size, by = 'max') => `<g id="m" data-fit="${cx},${cy},${size}" data-by="${by}">${body}</g>`;

const svg = (body, { bg } = {}) => `<!doctype html><html><head><style>
  @font-face { font-family: Gambarino; src: url('file://${FONT}'); }
  html, body { margin: 0; background: transparent; }
</style></head><body><svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ''}${body}</svg></body></html>`;

const files = {
  // iOS and store icon: full bleed, the OS rounds the corners.
  'icon.png': svg(fit(mark(), 512, 548, 640, 'h'), { bg: NIGHT }),
  // Android adaptive layers: the mark kept inside the 66% safe circle.
  'android-icon-foreground.png': svg(fit(mark(), 512, 530, 430, 'h')),
  'android-icon-background.png': svg('', { bg: NIGHT }),
  'android-icon-monochrome.png': svg(fit(mark({ color: '#FFFFFF' }), 512, 530, 430, 'h')),
  // Splash: mark and name on a transparent square; the plugin paints the night background.
  'splash-icon.png': svg(
    fit(mark(), 512, 380, 620) +
      `<text x="512" y="800" text-anchor="middle" font-family="Gambarino" font-size="128" fill="#F2F2F0" letter-spacing="-3">RKR Crackers</text>`,
  ),
};

const dir = mkdtempSync(join(tmpdir(), 'rkr-icons-'));
const b = await Browser.launch({ width: 1024, height: 1024 });
const p = await b.newPage({ width: 1024, height: 1024 });
await p.send('Emulation.setDefaultBackgroundColorOverride', { color: { r: 0, g: 0, b: 0, a: 0 } });
for (const [name, html] of Object.entries(files)) {
  const page = join(dir, `${name}.html`);
  writeFileSync(page, html); // a file page may load the local font; a data: page may not
  await p.goto(`file://${page}`, { settleMs: 400 });
  await p.eval('document.fonts.ready.then(() => true)');
  await p.eval(`(() => {
    const g = document.getElementById('m'); if (!g) return true;
    const [cx, cy, size] = g.dataset.fit.split(',').map(Number);
    const b = g.getBBox(); const k = size / (g.dataset.by === 'h' ? b.height : Math.max(b.width, b.height));
    g.setAttribute('transform', \`translate(\${cx - (b.x + b.width / 2) * k} \${cy - (b.y + b.height / 2) * k}) scale(\${k})\`);
    return true;
  })()`);
  const { data } = await p.send('Page.captureScreenshot', { format: 'png', clip: { x: 0, y: 0, width: 1024, height: 1024, scale: 1 } });
  writeFileSync(OUT + name, Buffer.from(data, 'base64'));
  console.log('wrote', name);
}
await b.close();
