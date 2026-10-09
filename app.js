/* VapeDesk demo backend
   Replaces backend/api.php + MySQL so the site can run on GitHub Pages.
   Everything lives in the browser: data is saved in localStorage, the login
   session in sessionStorage. app.js still calls api('action', body) exactly
   like before, it just lands here instead of on a server.
   NOTE: demo only. Passwords sit in plain text in the browser; a real system
   must hash them and check them on a server. */
(function () {
  const DB_KEY = 'vapedesk-demo-v1', SESSION_KEY = 'vapedesk-demo-session';
  const STEPS = ['Pending', 'Payment Verified', 'Ready for Pickup', 'Completed'];
  const ATTR_KEYS = { Flavor: 'flavor', Size: 'size', Nicotine: 'nicotine', Resistance: 'resistance' };

  /* ---------- tiny storage wrapper (falls back to memory if blocked) ---------- */
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] ?? null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } },
    del(k) { try { localStorage.removeItem(k); } catch (e) { delete mem[k]; } }
  };
  const ss = {
    get(k) { try { return sessionStorage.getItem(k); } catch (e) { return mem['s' + k] ?? null; } },
    set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { mem['s' + k] = v; } },
    del(k) { try { sessionStorage.removeItem(k); } catch (e) { delete mem['s' + k]; } }
  };

  /* ---------- date helpers ---------- */
  const pad = n => String(n).padStart(2, '0');
  const dayStr = d => d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  const nowStr = () => { const d = new Date(); return dayStr(d) + ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes()) + ':' + pad(d.getSeconds()); };

  /* ---------- seed data ---------- */
  function combos(attrs) {
    let out = [{}];
    for (const k in attrs) { const n = []; for (const o of out) for (const v of attrs[k]) n.push({ ...o, [k]: v }); out = n; }
    return out;
  }
  function makeVariants(pid, attrs, price, stock, reorder, priceFn) {
    return combos(attrs).map((c, i) => {
      const v = {
        sku: 'P' + pid + '-' + pad(i + 1), flavor: null, size: null, nicotine: null, resistance: null,
        price: priceFn ? priceFn(c) : price,
        stock: typeof stock === 'function' ? stock(i) : stock,
        reorder_level: reorder
      };
      for (const k in c) if (ATTR_KEYS[k]) v[ATTR_KEYS[k]] = c[k];
      return v;
    });
  }
  function seed() {
    const st = pid => i => (pid * 7 + i * 5) % 19;   // mix of healthy, low and zero stock
    const products = [
      { id: 1, name: 'Cloud Nine E-Liquid', category: 'E-liquids',
        variants: makeVariants(1, { Flavor: ['Mango', 'Menthol', 'Grape'], Size: ['30ml', '60ml'], Nicotine: ['3mg', '6mg'] }, 450, st(1), 5, c => c.Size === '60ml' ? 750 : 450) },
      { id: 2, name: 'Pod Cartridge 2-pack', category: 'Pods',
        variants: makeVariants(2, { Flavor: ['Mint', 'Berry'], Resistance: ['0.8Ω', '1.0Ω'] }, 250, st(2), 5) },
      { id: 3, name: 'Replacement Coil 5-pack', category: 'Coils',
        variants: makeVariants(3, { Resistance: ['0.6Ω', '0.8Ω', '1.2Ω'] }, 320, st(3), 5) },
      { id: 4, name: 'Disposable Vape 5000 puffs', category: 'Disposables',
        variants: makeVariants(4, { Flavor: ['Watermelon', 'Blueberry Ice', 'Lychee'], Nicotine: ['3mg', '5mg'] }, 650, st(4), 5) },
      { id: 5, name: 'Starter Kit', category: 'Devices',
        variants: makeVariants(5, { Resistance: ['0.8Ω'] }, 1800, 8, 3) }
    ];
    const all = products.flatMap(p => p.variants);
    const users = [
      { id: 1, name: 'Store Admin', email: 'admin@vapedesk.demo', password: 'admin123', role: 'admin' },
      { id: 2, name: 'Carla Cashier', email: 'cashier@vapedesk.demo', password: 'cashier123', role: 'cashier' },
      { id: 3, name: 'Carlo Custodian', email: 'custodian@vapedesk.demo', password: 'custodian123', role: 'custodian' },
      { id: 4, name: 'Juan Customer', email: 'customer@vapedesk.demo', password: 'customer123', role: 'customer' }
    ];
    // a week of past sales so the admin dashboard has something to show
    const sales = []; let rn = 1;
    for (let d = 6; d >= 0; d--) {
      const date = new Date(); date.setDate(date.getDate() - d);
      const n = 2 + (d % 3);
      for (let j = 0; j < n; j++) {
        const v = all[(d * 5 + j * 7) % all.length], qty = 1 + (j % 2);
        sales.push({ receipt_no: 'R-' + String(rn++).padStart(5, '0'), total: v.price * qty,
          created_at: dayStr(date) + ' ' + pad(9 + j * 2) + ':15:00', method: j % 2 ? 'GCash' : 'Cash', items: [{ sku: v.sku, qty }] });
      }
    }
    const orders = [
      { order_no: 'ORD-0001', user_id: 4, customer: 'Juan Customer', payment_method: 'Pay at store', gcash_ref: '', pickup_slot: 'Today, 4:00 PM',
        status: 'Pending', items: [{ sku: 'P1-01', qty: 1 }], total: all.find(v => v.sku === 'P1-01').price, created_at: nowStr() },
      { order_no: 'ORD-0002', user_id: 4, customer: 'Juan Customer', payment_method: 'GCash', gcash_ref: '1234567890', pickup_slot: 'Tomorrow, 10:00 AM',
        status: 'Payment Verified', items: [{ sku: 'P4-01', qty: 2 }], total: all.find(v => v.sku === 'P4-01').price * 2, created_at: nowStr() }
    ];
    return { users, products, sales, orders, audit: [], seq: { user: 5, product: 6, sale: rn, order: 3 } };
  }

  /* ---------- load / save ---------- */
  function loadDb() {
    const raw = ls.get(DB_KEY);
    if (raw) { try { return JSON.parse(raw); } catch (e) { /* corrupted, reseed */ } }
    const db = seed(); saveDb(db); return db;
  }
  const saveDb = db => ls.set(DB_KEY, JSON.stringify(db));
  window.resetDemoData = () => { ls.del(DB_KEY); ss.del(SESSION_KEY); location.reload(); };

  /* ---------- helpers ---------- */
  const fail = m => { throw new Error(m); };
  const pub = u => ({ id: u.id, name: u.name, email: u.email, role: u.role });
  function audit(db, u, action, detail) {
    db.audit.push({ created_at: nowStr(), role: u ? u.role : 'guest', action, detail: detail || '', ip: 'demo' });
    if (db.audit.length > 300) db.audit.shift();
  }
  function findVariant(db, sku) {
    for (const p of db.products) { const v = p.variants.find(x => x.sku === sku); if (v) return { p, v }; }
    return {};
  }
  // checks stock for a list of {sku, qty}, takes it off the shelf and returns the total
  function takeStock(db, items) {
    if (!Array.isArray(items) || !items.length) fail('The cart is empty.');
    const need = {};
    for (const it of items) {
      const q = Number(it.qty);
      if (!Number.isInteger(q) || q < 1) fail('Invalid quantity.');
      need[it.sku] = (need[it.sku] || 0) + q;
    }
    let total = 0;
    for (const sku in need) {
      const { p, v } = findVariant(db, sku);
      if (!v || p.archived) fail('An item in the cart is no longer available.');
      if (v.stock < need[sku]) fail('Not enough stock for ' + p.name + '.');
      total += v.price * need[sku];
    }
    for (const sku in need) findVariant(db, sku).v.stock -= need[sku];
    return total;
  }
  const num = x => (x === '' || x == null ? NaN : Number(x));

  /* ---------- who may call what (mirrors the role checks in the PHP) ---------- */
  const PUBLIC = ['me', 'login', 'register', 'logout'];
  const ROLES = {
    orders: ['cashier'], order_update: ['cashier'], sale: ['cashier'],
    my_orders: ['customer'], order_place: ['customer'],
    dashboard: ['admin'], audit_log: ['admin'],
    stock_adjust: ['custodian'], product_create: ['custodian'], product_delete: ['custodian'], price_set: ['custodian']
  };

  /* ---------- actions ---------- */
  const H = {
    me(db, u) { return { user: u ? pub(u) : null }; },

    register(db, u, b) {
      const name = String(b.name || '').trim(), email = String(b.email || '').trim().toLowerCase(), pw = String(b.password || '');
      if (!name) fail('Please enter your full name.');
      if (!/^\S+@\S+\.\S+$/.test(email)) fail('Please enter a valid email address.');
      if (pw.length < 8) fail('Password must be at least 8 characters.');
      if (db.users.some(x => x.email === email)) fail('That email is already registered.');
      const nu = { id: db.seq.user++, name, email, password: pw, role: 'customer' };
      db.users.push(nu); audit(db, nu, 'register', email);
      return { ok: true };
    },
    login(db, u, b) {
      const email = String(b.email || '').trim().toLowerCase();
      const user = db.users.find(x => x.email === email && x.password === String(b.password || ''));
      if (!user) fail('Wrong email or password.');
      ss.set(SESSION_KEY, String(user.id)); audit(db, user, 'login', 'Signed in');
      return { user: pub(user) };
    },
    logout(db, u) { if (u) audit(db, u, 'logout', 'Signed out'); ss.del(SESSION_KEY); return { ok: true }; },

    products(db) {
      return db.products.filter(p => !p.archived).map(p => ({ id: p.id, name: p.name, category: p.category, variants: p.variants }));
    },

    sale(db, u, b) {
      const total = takeStock(db, b.items);
      let change = 0;
      if (b.payment_method === 'Cash') {
        const t = num(b.tendered);
        if (!Number.isFinite(t) || t < total) fail('Amount tendered is less than the total.');
        change = t - total;
      } else if (b.payment_method === 'GCash') {
        if (!String(b.gcash_ref || '').trim()) fail('Enter the GCash reference number.');
      } else fail('Choose a payment method.');
      const receipt_no = 'R-' + String(db.seq.sale++).padStart(5, '0');
      db.sales.push({ receipt_no, total, created_at: nowStr(), method: b.payment_method, items: b.items.map(i => ({ sku: i.sku, qty: +i.qty })) });
      audit(db, u, 'sale', receipt_no + ' · ₱' + total.toFixed(2) + ' · ' + b.payment_method);
      return { receipt_no, total, change };
    },

    orders(db) { return db.orders.slice().reverse(); },
    my_orders(db, u) { return db.orders.filter(o => o.user_id === u.id).reverse(); },
    order_place(db, u, b) {
      if (!['Pay at store', 'GCash'].includes(b.payment_method)) fail('Choose a payment method.');
      if (!String(b.pickup_slot || '').trim()) fail('Choose a pickup time.');
      if (b.payment_method === 'GCash' && !String(b.gcash_ref || '').trim()) fail('Enter your GCash reference number.');
      const total = takeStock(db, b.items);
      const order_no = 'ORD-' + String(db.seq.order++).padStart(4, '0');
      db.orders.push({ order_no, user_id: u.id, customer: u.name, payment_method: b.payment_method,
        gcash_ref: b.payment_method === 'GCash' ? String(b.gcash_ref).trim() : '', pickup_slot: b.pickup_slot, status: 'Pending',
        items: b.items.map(i => ({ sku: i.sku, qty: +i.qty })), total, created_at: nowStr() });
      audit(db, u, 'order_place', order_no);
      return { order_no };
    },
    order_update(db, u, b) {
      const o = db.orders.find(x => x.order_no === b.order_no);
      if (!o) fail('Order not found.');
      const i = STEPS.indexOf(o.status);
      if (i < 0 || i === 3) fail('This order is already closed.');
      if (b.to === 'cancel') {
        o.items.forEach(it => { const { v } = findVariant(db, it.sku); if (v) v.stock += it.qty; });
        o.status = 'Cancelled';
      } else if (b.to === 'next') o.status = STEPS[i + 1];
      else fail('Unknown order action.');
      audit(db, u, 'order_update', o.order_no + ' → ' + o.status);
      return { status: o.status };
    },

    stock_adjust(db, u, b) {
      const { p, v } = findVariant(db, b.sku);
      if (!v) fail('Variant not found.');
      const q = Number(b.qty);
      if (!Number.isInteger(q) || q < 1) fail('Enter a whole number of 1 or more.');
      if (!['Delivery', 'Damage', 'Recount', 'Shrinkage'].includes(b.reason)) fail('Choose a reason.');
      if (b.reason === 'Delivery') v.stock += q;
      else { if (q > v.stock) fail('You cannot remove more than the current stock (' + v.stock + ').'); v.stock -= q; }
      audit(db, u, 'stock_adjust', b.sku + ' · ' + b.reason + ' · ' + q);
      return { stock: v.stock };
    },
    price_set(db, u, b) {
      const { v } = findVariant(db, b.sku);
      if (!v) fail('Variant not found.');
      const pr = num(b.price);
      if (!Number.isFinite(pr) || pr < 0) fail('Enter a valid price.');
      audit(db, u, 'price_set', b.sku + ' · ₱' + v.price + ' → ₱' + pr);
      v.price = pr;
      return { price: pr };
    },
    product_create(db, u, b) {
      const name = String(b.name || '').trim(), category = String(b.category || '').trim();
      if (!name) fail('Enter a product name.');
      if (!category) fail('Enter a category.');
      const price = num(b.price), stock = num(b.stock), reorder = num(b.reorder);
      if (!Number.isFinite(price) || price < 0) fail('Enter a valid price.');
      if (!Number.isInteger(stock) || stock < 0) fail('Stock must be a whole number, 0 or more.');
      if (!Number.isInteger(reorder) || reorder < 0) fail('Reorder level must be a whole number, 0 or more.');
      const attrs = {};
      for (const k in (b.attrs || {})) if (ATTR_KEYS[k] && Array.isArray(b.attrs[k]) && b.attrs[k].length) attrs[k] = b.attrs[k];
      const id = db.seq.product++, variants = makeVariants(id, attrs, price, stock, reorder);
      if (variants.length > 100) fail('Too many combinations (max 100 variants).');
      db.products.push({ id, name, category, variants });
      audit(db, u, 'product_create', name + ' · ' + variants.length + ' variant(s)');
      return { id, variants: variants.length };
    },
    product_delete(db, u, b) {
      const idx = db.products.findIndex(x => x.id === +b.id);
      if (idx < 0) fail('Product not found.');
      const p = db.products[idx], skus = p.variants.map(v => v.sku);
      const used = db.sales.some(s => s.items.some(i => skus.includes(i.sku))) || db.orders.some(o => o.items.some(i => skus.includes(i.sku)));
      if (used) { p.archived = true; audit(db, u, 'product_archive', p.name); return { result: 'archived' }; }
      db.products.splice(idx, 1); audit(db, u, 'product_delete', p.name);
      return { result: 'removed' };
    },

    dashboard(db) {
      const today = dayStr(new Date()), byDay = {}, sold = {};
      db.sales.forEach(s => { const d = s.created_at.slice(0, 10); byDay[d] = (byDay[d] || 0) + s.total; });
      const todays = db.sales.filter(s => s.created_at.slice(0, 10) === today);
      todays.forEach(s => s.items.forEach(i => { sold[i.sku] = (sold[i.sku] || 0) + i.qty; }));
      const days = [];
      for (let i = 6; i >= 0; i--) { const d = new Date(); d.setDate(d.getDate() - i); const k = dayStr(d); days.push({ day: k, total: byDay[k] || 0 }); }
      const live = db.products.filter(p => !p.archived).flatMap(p => p.variants);
      return {
        sales_today: byDay[today] || 0, transactions: todays.length,
        pending_orders: db.orders.filter(o => o.status === 'Pending').length,
        low_stock: live.filter(v => v.stock <= v.reorder_level).length,
        last_7_days: days,
        top_variants: Object.entries(sold).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([sku, n]) => ({ sku, sold: n }))
      };
    },
    audit_log(db) { return db.audit.slice().reverse().slice(0, 200); }
  };

  /* ---------- the one function app.js calls ---------- */
  window.api = async function (action, body) {
    await new Promise(r => setTimeout(r, 60));          // feels like a real request
    const h = H[action];
    if (!h) throw new Error('Unknown action: ' + action);
    const db = loadDb();
    const u = db.users.find(x => String(x.id) === ss.get(SESSION_KEY)) || null;
    if (!PUBLIC.includes(action)) {
      if (!u) throw new Error('Please log in first.');
      if (ROLES[action] && !ROLES[action].includes(u.role)) throw new Error('Your role is not allowed to do that.');
    }
    const out = h(db, u, body || {});                   // throws before saving if anything is invalid
    saveDb(db);
    return JSON.parse(JSON.stringify(out === undefined ? {} : out));
  };
})();
