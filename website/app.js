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
  let lastTotal = '';
  const pulse = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };
  const totalText = document.querySelector('[data-total-text]');
  const saveText = document.querySelector('[data-save-text]');
  const countBadge = document.querySelector('[data-count-badge]');

  function render() {
    let sum = 0, items = 0, products = 0, mrp = 0;
    rows.forEach((r) => {
      const q = clampQty(r.input.value);
      r.el.classList.toggle('is-picked', q > 0);
      if (q > 0 && r.product) { sum += paise(r.product.offer_price) * q; mrp += paise(r.product.mrp) * q; items += q; products += 1; }
    });
    const short = MIN * 100 - sum;
    totalText.textContent = inr(sum / 100);
    saveText.textContent = short > 0 ? `Add ₹${Math.ceil(short / 100).toLocaleString('en-IN')} more` : `Saved ₹${Math.round((mrp - sum) / 100).toLocaleString('en-IN')}`;
    saveText.classList.toggle('is-short', short > 0);
    countBadge.textContent = String(items);
    if (totalText.textContent !== lastTotal) { lastTotal = totalText.textContent; pulse(totalText, 'tick'); }
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
    r.el.querySelector('[data-add]').addEventListener('click', () => {
      r.input.value = '1';
      update();
      r.el.querySelector('[data-step="1"]').focus({ preventScroll: true });
    });
    r.el.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      const v = clampQty(clampQty(r.input.value) + Number(b.dataset.step));
      r.input.value = v ? String(v) : '';
      pulse(r.input, 'bump');
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

// ================= feel: smooth scroll, entrances, feedback =================
(() => {
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;

  // smooth, weighted scrolling (wheel and anchor links)
  let lenis = null;
  if (!reduce && window.Lenis && !location.search.includes('nosmooth')) {
    lenis = new Lenis({ duration: 1.15, easing: (t) => 1 - Math.pow(1 - t, 4) });
    const raf = (t) => { lenis.raf(t); requestAnimationFrame(raf); };
    requestAnimationFrame(raf);
    document.querySelectorAll('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
      const target = document.querySelector(a.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      lenis.scrollTo(target, { offset: a.getAttribute('href') === '#top' ? 0 : -70 });
    }));
  }

  // the name, letter by letter
  document.querySelectorAll('[data-split]').forEach((el) => {
    const text = el.textContent;
    el.textContent = '';
    [...text].forEach((ch, i) => {
      const span = document.createElement('span');
      span.className = 'ch'; span.style.setProperty('--c', i); span.setAttribute('aria-hidden', 'true');
      span.textContent = ch === ' ' ? '\u00a0' : ch;
      el.appendChild(span);
    });
  });

  // nav: sticks after the first screen, hides while scrolling down, returns on the way up
  const top = document.querySelector('[data-top]');
  const hero = document.getElementById('top');
  let lastY = scrollY;
  addEventListener('scroll', () => {
    const y = scrollY;
    const past = y > hero.offsetHeight * 0.8;
    top.classList.toggle('is-stuck', past);
    top.classList.toggle('is-hidden', past && y > lastY + 4);
    if (y < lastY - 4 || !past) top.classList.remove('is-hidden');
    lastY = y;
  }, { passive: true });

  // ripple from the press point on every button
  document.addEventListener('pointerdown', (e) => {
    const b = e.target.closest('.button, .step, .square');
    if (!b || reduce) return;
    const r = b.getBoundingClientRect();
    const size = Math.max(r.width, r.height) * 2.2;
    const dot = document.createElement('span');
    dot.className = 'ripple';
    Object.assign(dot.style, { width: size + 'px', height: size + 'px', left: e.clientX - r.left - size / 2 + 'px', top: e.clientY - r.top - size / 2 + 'px' });
    if (getComputedStyle(b).position === 'static') b.style.position = 'relative';
    b.style.overflow = 'hidden';
    b.appendChild(dot);
    setTimeout(() => dot.remove(), 650);
  });

  // magnetic primary buttons
  if (fine && !reduce) document.querySelectorAll('[data-magnet]').forEach((b) => {
    b.addEventListener('pointermove', (e) => {
      const r = b.getBoundingClientRect();
      b.style.transform = `translate(${(e.clientX - r.left - r.width / 2) * 0.18}px, ${(e.clientY - r.top - r.height / 2) * 0.3}px)`;
    });
    b.addEventListener('pointerleave', () => { b.style.transform = ''; });
  });

  // figures count up once
  const counters = document.querySelectorAll('[data-count]');
  if ('IntersectionObserver' in window && !reduce) {
    const io = new IntersectionObserver((entries) => entries.forEach((en) => {
      if (!en.isIntersecting) return;
      io.unobserve(en.target);
      const el = en.target, end = Number(el.dataset.count), suf = el.dataset.suffix || '';
      const t0 = performance.now(), dur = 1400;
      const step = (t) => {
        const k = Math.min(1, (t - t0) / dur), v = Math.round(end * (1 - Math.pow(1 - k, 3)));
        el.textContent = v + suf;
        if (k < 1) requestAnimationFrame(step);
      };
      requestAnimationFrame(step);
    }), { threshold: 0.6 });
    counters.forEach((c) => io.observe(c));
  }
})();

// ---------- category bar: follows the list, highlights where you are ----------
(() => {
  const nav = document.querySelector('[data-catnav]');
  if (!nav || !('IntersectionObserver' in window)) return;
  const links = new Map([...nav.querySelectorAll('[data-cat]')].map((a) => [a.dataset.cat, a]));
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((a) => a.classList.remove('is-on'));
      const a = links.get(e.target.id);
      if (!a) continue;
      a.classList.add('is-on');
      nav.scrollTo({ left: a.offsetLeft - nav.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' });
    }
  }, { rootMargin: '-30% 0px -65% 0px' });
  document.querySelectorAll('[data-group]').forEach((g) => io.observe(g));
})();
