// RKR Crackers price list: live prices, quantities and the running estimate.
// The cart is written in the same shape the app (SHOP_URL) reads, so "Send estimate" opens it filled in.
(() => {
  const body = document.body;
  const API = body.dataset.api;
  const MIN = Number(body.dataset.min || 0);
  const CART_KEY = 'rkr-cart';
  const inr = (n) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const paise = (v) => Math.round(Number(v) * 100);

  const rows = new Map(); // code -> { el, input, price, mrp, product }
  document.querySelectorAll('.item').forEach((el) => {
    rows.set(Number(el.dataset.code), { el, input: el.querySelector('[data-qty]'), price: el.querySelector('[data-price]'), mrp: el.querySelector('[data-mrp]') });
  });

  const store = {
    read() {
      try { return JSON.parse(localStorage.getItem(CART_KEY))?.state?.lines || {}; } catch { return {}; }
    },
    write(lines) {
      try { localStorage.setItem(CART_KEY, JSON.stringify({ state: { lines }, version: 0 })); } catch {}
    },
  };

  const totalTexts = document.querySelectorAll('[data-total-text]');
  const stageTotal = document.querySelector('.stage-total');
  const phoneBar = document.querySelector('[data-phone-bar]');
  const defaultText = totalTexts[0]?.textContent || '';

  function render() {
    let sum = 0, count = 0, products = 0;
    rows.forEach((r) => {
      const q = Number(r.input.value) || 0;
      r.el.classList.toggle('is-picked', q > 0);
      if (q > 0 && r.product) { sum += paise(r.product.offer_price) * q; count += q; products += 1; }
    });
    const short = MIN * 100 - sum;
    const text = products === 0 ? defaultText
      : short > 0 ? `${inr(sum / 100)} · add ${inr(short / 100)} more`
      : `Your estimate ${inr(sum / 100)} · send →`;
    totalTexts.forEach((t) => { t.textContent = text; });
    stageTotal?.classList.toggle('has-items', products > 0);
    if (phoneBar) phoneBar.hidden = products === 0;
  }

  function save() {
    const lines = {};
    rows.forEach((r) => {
      const q = Math.min(Math.max(Math.floor(Number(r.input.value) || 0), 0), 999);
      if (q > 0 && r.product) lines[r.product.id] = { product: r.product, quantity: q };
    });
    store.write(lines);
  }

  rows.forEach((r) => {
    r.input.addEventListener('input', () => { render(); save(); });
    r.input.addEventListener('change', () => {
      const v = Math.min(Math.max(Math.floor(Number(r.input.value) || 0), 0), 999);
      r.input.value = v ? String(v) : '';
      render(); save();
    });
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
    // Items switched off in the shop admin are out of stock: hide them from the order form.
    rows.forEach((r, code) => { if (!live.has(code)) r.el.hidden = true; });
    const saved = store.read();
    Object.values(saved).forEach(({ product, quantity }) => {
      const r = rows.get(product?.code);
      if (r && r.product) r.input.value = String(quantity);
    });
    render(); save();
  }).catch(() => {
    totalTexts.forEach((t) => { t.textContent = 'Call to order'; });
    document.querySelectorAll('[data-send]').forEach((a) => { a.href = 'tel:+919500403856'; });
  });

  // ---------- the stage: the picture follows the section you are reading ----------
  const slides = [...document.querySelectorAll('.split:not(.split-faq) .slide')];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let current = 'cover', cycle = null, cycleIndex = 0;
  function show(name) {
    if (name === current) return;
    current = name;
    clearInterval(cycle);
    const set = slides.filter((s) => s.dataset.slide === name);
    cycleIndex = 0;
    slides.forEach((s) => s.classList.toggle('is-on', s === set[0]));
    if (set.length > 1 && !reduce) {
      cycle = setInterval(() => {
        if (document.hidden) return;
        cycleIndex = (cycleIndex + 1) % set.length;
        slides.forEach((s) => s.classList.toggle('is-on', s === set[cycleIndex]));
      }, 5500);
    }
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) if (e.isIntersecting) show(e.target.dataset.stage);
    }, { rootMargin: '-45% 0px -45% 0px' });
    document.querySelectorAll('[data-stage]').forEach((s) => io.observe(s));
    const top = document.getElementById('top');
    new IntersectionObserver(([e]) => { if (e.isIntersecting) show('cover'); }, { rootMargin: '-45% 0px -45% 0px' }).observe(top);
  }

  // ---------- assortment tabs ----------
  const tabs = document.querySelectorAll('[data-tab]');
  const title = document.querySelector('[data-tab-title]');
  const text = document.querySelector('[data-tab-text]');
  const link = document.querySelector('[data-tab-link]');
  tabs.forEach((tab) => tab.addEventListener('click', () => {
    tabs.forEach((t) => t.setAttribute('aria-selected', String(t === tab)));
    title.textContent = tab.dataset.title;
    text.textContent = tab.dataset.text;
    link.href = '#' + tab.dataset.tab;
    if (!reduce) for (const el of [title, text]) el.animate([{ opacity: 0, transform: 'translateY(12px)' }, { opacity: 1, transform: 'none' }], { duration: 420, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
  }));
})();
