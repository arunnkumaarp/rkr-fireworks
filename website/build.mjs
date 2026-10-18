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
const INKS = ['#2F4FA2', '#2E7D32', '#B0186B', '#B9410A', '#5E2B97'];

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
  .map((g, gi) => `
        <section class="group" id="${slug(g.name)}" aria-labelledby="g-${gi}">
          <h3 class="banner" id="g-${gi}" style="--ink-band:${INKS[gi % INKS.length]}" data-reveal>${esc(g.name)}</h3>
          <ul class="items">${g.items
            .map((p) => `
            <li class="item" data-code="${p.code}">
              <span class="item-name">${esc(p.name)}</span>
              <span class="item-price nums" data-price>${inr(p.offer)}</span>
              <span class="item-note nums">Code ${p.code} · MRP <s data-mrp>${inr(p.mrp)}</s> · 1 ${esc(p.unit)}</span>
              <label class="qty"><span class="sr-only">Quantity of ${esc(p.name)}</span><input type="number" inputmode="numeric" min="0" max="999" placeholder="0" data-qty></label>
            </li>`)
            .join('')}
          </ul>
        </section>`)
  .join('');

const gift = range('Gift Boxes'), family = range('Family Pack'), toys = range('RKR Toys Special Crackers');
const tabs = [
  { id: 'gift-boxes', label: 'Gift boxes', title: 'Gift boxes', text: `${gift.count} ready-packed boxes, from ${inr(gift.low)} to the Kohinoor box at ${inr(gift.high)}. The quickest way to order for a whole family.` },
  { id: 'family-pack', label: 'Family packs', title: 'Family packs', text: `Our two biggest assortments, at ${inr(family.low)} and ${inr(family.high)}, with enough for every night of the festival.` },
  { id: 'rkr-toys-special-crackers', label: 'Toy specials', title: 'Toy specials', text: `${toys.count} novelty pieces for children, from ${inr(toys.low)} to ${inr(toys.high)}: candles, sharks, cartoon fountains and more.` },
];

const faq = [
  ['Is there a minimum order?', `Yes, ${inr0(MIN_ORDER)} at our offer prices, before transport.`],
  ['Do I pay online?', 'No. You send an estimate here, we call you to confirm the total, and then you pay by UPI or bank transfer.'],
  ['How is it delivered?', 'By lorry transport to the transport office nearest you. We share the LR number so you can track and collect it.'],
  ['Who pays for transport?', 'You pay the transport charges at the office when you collect your parcel.'],
  ['Can I change my order after sending it?', 'Yes. Tell us on the confirmation call and we update the estimate before you pay.'],
  ['Where do you deliver?', 'Only where the sale of firecrackers is allowed. Tell us your town on the call and we will confirm.'],
  ['What about green crackers and timings?', 'Follow the rules in your area. Ask us on the call which items suit them.'],
  ['What if something arrives damaged?', 'Send us photos on WhatsApp within 24 hours of collecting and we will sort it out.'],
  ['Where do I see my orders?', `Log in with your email at <a class="link-plain" href="${SHOP_URL}/orders">your orders</a>. Each estimate shows its status and LR number.`],
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
  .replace('{{INDEX}}', groups.map((g) => `<li><a href="#${slug(g.name)}">${esc(g.name)}</a></li>`).join(''))
  .replace('{{LIST}}', list)
  .replace('{{TABS}}', tabs.map((t, i) => `<button type="button" role="tab" aria-selected="${i === 0}" data-tab="${t.id}" data-title="${esc(t.title)}" data-text="${esc(t.text)}">${t.label}</button>`).join(''))
  .replace('{{TAB_TITLE}}', esc(tabs[0].title))
  .replace('{{TAB_TEXT}}', esc(tabs[0].text))
  .replace('{{FAQ}}', faq.map(([q, a]) => `<p data-reveal><strong>${q}</strong> ${a}</p>`).join('\n          '))
  .replace('{{CREDITS}}', creditLine);
writeFileSync(new URL('./index.html', here), html);
console.log(`index.html: ${products.length} products in ${groups.length} groups`);
