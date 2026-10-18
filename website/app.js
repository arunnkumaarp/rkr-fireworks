// RKR Crackers price list: live prices, quantities, search and the running estimate.
// The cart is written in the same shape the app (SHOP_URL) reads, so "Send estimate" opens it filled in.
(() => {
  const body = document.body;
  const API = body.dataset.api;
  const MIN = Number(body.dataset.min || 0);
  const CART_KEY = 'rkr-cart';
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const inr = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paise = (v) => Math.round(Number(v) * 100);
  const clampQty = (v) => Math.min(Math.max(Math.floor(Number(v) || 0), 0), 999);

  const rows = new Map(); // code -> { el, input, price, mrp, product }
  document.querySelectorAll('.row').forEach((el) => {
    rows.set(Number(el.dataset.code), { el, input: el.querySelector('[data-qty]'), price: el.querySelector('[data-price]'), mrp: el.querySelector('[data-mrp]') });
  });

  const store = {
    read() { try { return JSON.parse(localStorage.getItem(CART_KEY))?.state?.lines || {}; } catch { return {}; } },
    write(lines) { try { localStorage.setItem(CART_KEY, JSON.stringify({ state: { lines }, version: 0 })); } catch {} },
  };

  const bar = document.querySelector('[data-bar]');
  const totalText = document.querySelector('[data-total-text]');

  function render() {
    let sum = 0, items = 0, products = 0;
    rows.forEach((r) => {
      const q = clampQty(r.input.value);
      r.el.classList.toggle('is-picked', q > 0);
      if (q > 0 && r.product) { sum += paise(r.product.offer_price) * q; items += q; products += 1; }
    });
    const short = MIN * 100 - sum;
    totalText.textContent = short > 0
      ? `${inr(sum / 100)} · add ${inr(short / 100)} more`
      : `${inr(sum / 100)} · ${items} item${items === 1 ? '' : 's'}`;
    bar.hidden = products === 0;
    body.classList.toggle('has-bar', products > 0);
  }

  function save() {
    const lines = {};
    rows.forEach((r) => {
      const q = clampQty(r.input.value);
      if (q > 0 && r.product) lines[r.product.id] = { product: r.product, quantity: q };
    });
    store.write(lines);
  }
  const update = () => { render(); save(); };

  rows.forEach((r) => {
    r.input.addEventListener('input', update);
    r.input.addEventListener('change', () => { const v = clampQty(r.input.value); r.input.value = v ? String(v) : ''; update(); });
    r.el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      const v = clampQty(clampQty(r.input.value) + Number(b.dataset.step));
      r.input.value = v ? String(v) : '';
      update();
    }));
  });

  // Live prices and product ids from the shop; the printed prices stay if the API is unreachable.
  fetch(`${API}/products/`).then((res) => (res.ok ? res.json() : Promise.reject(res.status))).then((list) => {
    const live = new Set();
    for (const p of list) {
      const r = rows.get(p.code);
      if (!r) continue;
      r.product = p;
      live.add(p.code);
      r.price.textContent = inr(Number(p.offer_price));
      r.mrp.textContent = inr(Number(p.mrp));
    }
    rows.forEach((r, code) => { if (!live.has(code)) { r.el.dataset.off = '1'; r.el.hidden = true; } }); // switched off in the shop admin
    Object.values(store.read()).forEach(({ product, quantity }) => {
      const r = rows.get(product?.code);
      if (r && r.product) r.input.value = String(quantity);
    });
    update();
  }).catch(() => {
    // Without the shop's server the list still reads; ordering falls back to a phone call.
    document.querySelectorAll('[data-send]').forEach((a) => { a.href = 'tel:+919500403856'; a.textContent = 'Call to order'; });
  });

  // ---------- search and jump ----------
  const search = document.querySelector('[data-search]');
  const empty = document.querySelector('[data-empty]');
  search.addEventListener('input', () => {
    const q = search.value.trim().toLowerCase();
    let shown = 0;
    document.querySelectorAll('[data-group]').forEach((g) => {
      let inGroup = 0;
      g.querySelectorAll('.row').forEach((row) => {
        const match = !q || row.dataset.name.includes(q) || row.dataset.code === q;
        row.hidden = !match || row.dataset.off === '1';
        if (!row.hidden) inGroup++;
      });
      g.hidden = inGroup === 0;
      shown += inGroup;
    });
    empty.hidden = shown > 0;
  });
  document.querySelector('[data-jump]').addEventListener('change', (e) => {
    const target = document.getElementById(e.target.value);
    if (target) target.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
    e.target.value = '';
  });

  // ---------- the row of moments ----------
  const moments = document.querySelector('[data-moments]');
  const progress = document.querySelector('[data-progress]');
  const syncProgress = () => {
    const max = moments.scrollWidth - moments.clientWidth;
    const shown = moments.clientWidth / moments.scrollWidth;
    progress.style.width = `${Math.min(100, (shown + (max > 0 ? moments.scrollLeft / max : 1) * (1 - shown)) * 100)}%`;
  };
  moments.addEventListener('scroll', syncProgress, { passive: true });
  addEventListener('resize', syncProgress);
  syncProgress();
  document.querySelectorAll('[data-scroll]').forEach((b) => b.addEventListener('click', () => {
    const step = moments.querySelector('.moment').getBoundingClientRect().width + 32;
    moments.scrollBy({ left: step * Number(b.dataset.scroll), behavior: reduce ? 'auto' : 'smooth' });
  }));
})();
