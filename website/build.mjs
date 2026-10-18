// Builds index.html from the printed price list (backend/seed CSV) so the whole list is in the HTML:
// readable without JavaScript and by search engines. app.js then refreshes prices from the API.
//   node build.mjs            API_URL=https://api.example.com/api/v1 SHOP_URL=/shop node build.mjs
import { readFileSync, writeFileSync } from 'node:fs';

const here = new URL('.', import.meta.url);
const API_URL = process.env.API_URL || 'http://localhost:8000/api/v1';
const SHOP_URL = process.env.SHOP_URL || '/shop';
const DISCOUNT = 80;
const MIN_ORDER = 1000;
const PHONES = ['9500403856', '9176020261'];

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const inr = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const inr0 = (n) => '₹' + n.toLocaleString('en-IN');
const phone = (p) => `${p.slice(0, 5)} ${p.slice(5)}`;
const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

function parseCsv(text) {
  const rows = [];
  for (const line of text.trim().split('\n').slice(1)) {
    const cells = [];
    let cur = '', quoted = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (quoted) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') quoted = false;
        else cur += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { cells.push(cur); cur = ''; }
      else cur += ch;
    }
    cells.push(cur);
    const [code, name, category, mrp, unit] = cells;
    rows.push({ code: +code, name, category, mrp: +mrp, unit, offer: Math.round(+mrp * (100 - DISCOUNT)) / 100 });
  }
  return rows;
}

const products = parseCsv(readFileSync(new URL('../backend/seed/products_2026.csv', here), 'utf8'));
const groups = [];
for (const p of products) {
  let g = groups.find((x) => x.name === p.category);
  if (!g) groups.push((g = { name: p.category, items: [] }));
  g.items.push(p);
}
const range = (cat) => {
  const items = groups.find((g) => g.name === cat).items;
  const prices = items.map((i) => i.offer);
  return { count: items.length, low: Math.min(...prices), high: Math.max(...prices) };
};

const credits = JSON.parse(readFileSync(new URL('./assets/credits.json', here), 'utf8'));
const creditLine = credits
  .map((c) => `<a href="${esc(c.page)}">${esc(c.title)}</a> by ${esc(c.creator || 'unknown')}, ${esc(c.license)}`)
  .join(' · ');

const list = groups
  .map((g) => `
        <section class="group" id="${slug(g.name)}" aria-labelledby="g-${slug(g.name)}" data-group>
          <h3 class="group-name" id="g-${slug(g.name)}" data-reveal>${esc(g.name)}</h3>
          <ul class="rows">${g.items
            .map((p) => `
            <li class="row" data-code="${p.code}" data-name="${esc(p.name.toLowerCase())}">
              <span class="r-name">${esc(p.name)}</span>
              <span class="r-mrp nums"><s data-mrp>${inr(p.mrp)}</s></span>
              <span class="r-price nums"><span data-price>${inr(p.offer)}</span> <span class="r-unit">/ ${esc(p.unit.toLowerCase())}</span></span>
              <span class="r-qty">
                <button type="button" class="add" data-add aria-label="Add ${esc(p.name)}">Add</button>
                <button type="button" class="step" data-step="-1" aria-label="One less ${esc(p.name)}">−</button>
                <input type="number" inputmode="numeric" min="0" max="999" placeholder="0" aria-label="Quantity of ${esc(p.name)}" data-qty>
                <button type="button" class="step" data-step="1" aria-label="One more ${esc(p.name)}">+</button>
              </span>
            </li>`)
            .join('')}
          </ul>
        </section>`)
  .join('');

const gift = range('Gift Boxes'), family = range('Family Pack'), toys = range('RKR Toys Special Crackers');
const boxCaption = `Gift boxes ${inr(gift.low)} to ${inr(gift.high)} · Family packs ${inr(family.low)} and ${inr(family.high)} · ${toys.count} toy specials from ${inr(toys.low)}`;

const faq = [
  ['Do I pay online?', 'No. You send an estimate here, we call you to confirm the total, and then you pay by UPI or bank transfer.'],
  ['How is it delivered?', 'By lorry transport to the transport office nearest you. We share the LR number so you can track and collect it.'],
  ['Who pays for transport?', 'You pay the transport charges at the office when you collect your parcel.'],
  ['Can I change my order after sending it?', 'Yes. Tell us on the confirmation call and we update the estimate before you pay.'],
  ['Where do you deliver?', 'Only where the sale of firecrackers is allowed. Tell us your town on the call and we will confirm.'],
  ['What if something arrives damaged?', 'Send us photos on WhatsApp within 24 hours of collecting and we will sort it out.'],
];

const template = readFileSync(new URL('./index.template.html', here), 'utf8');
const html = template
  .replaceAll('{{API_URL}}', API_URL)
  .replaceAll('{{SHOP_URL}}', SHOP_URL)
  .replaceAll('{{PHONE1}}', PHONES[0])
  .replaceAll('{{PHONE1_FMT}}', phone(PHONES[0]))
  .replaceAll('{{PHONE2}}', PHONES[1])
  .replaceAll('{{PHONE2_FMT}}', phone(PHONES[1]))
  .replaceAll('{{MIN_ORDER}}', inr0(MIN_ORDER))
  .replaceAll('{{COUNT}}', String(products.length))
  .replace('{{MARQUEE}}', [0, 1].map((k) => groups.map((g) => `<a href="#${slug(g.name)}"${k ? ' tabindex="-1" aria-hidden="true"' : ''}>${esc(g.name)}</a><span class="dot" aria-hidden="true"></span>`).join('')).join(''))
  .replace('{{CATNAV}}', groups.map((g) => `<a href="#${slug(g.name)}" data-cat="${slug(g.name)}">${esc(g.name)}</a>`).join(''))
  .replace('{{LIST}}', list)
  .replace('{{BOX_CAPTION}}', esc(boxCaption))
  .replace('{{FAQ}}', faq.map(([q, a]) => `<details><summary>${q}</summary><p>${a}</p></details>`).join('\n          '))
  .replace('{{CREDITS}}', creditLine);
writeFileSync(new URL('./index.html', here), html);
console.log(`index.html: ${products.length} products in ${groups.length} groups`);
