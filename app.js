/* ---------- LOCAL STORAGE DATABASE SEED & HELPER ---------- */
const DB_KEY = 'vapedesk_db_v1';

/* Tagged template that strips whitespace around newlines so multi-line
   HTML in source produces the same output as a one-liner. */
function html(strings, ...values) {
  return strings.reduce(
    (out, s, i) => out + s.replace(/\s*\n\s*/g, '') + (i < values.length ? values[i] : ''),
    ''
  );
}

function getDB() {
  let db = localStorage.getItem(DB_KEY);
  if (!db) {
    db = {
      users: [
        { id: 1, name: 'Store Admin', email: 'admin@vapedesk.com', password: 'admin123', role: 'admin' },
        { id: 2, name: 'Cashier One', email: 'cashier@vapedesk.com', password: 'cashier123', role: 'cashier' },
        { id: 3, name: 'Custodian One', email: 'custodian@vapedesk.com', password: 'custodian123', role: 'custodian' },
        { id: 4, name: 'John Customer', email: 'customer@vapedesk.com', password: 'customer123', role: 'customer' }
      ],
      products: [
        {
          id: 1,
          name: 'Cloud Nine E-Liquid',
          cat: 'E-liquids',
          variants: [
            { sku: 'CN-MAN-3MG', at: { 'Flavor': 'Mango', 'Nicotine': '3mg' }, price: 250, stock: 12, reorder_level: 5 },
            { sku: 'CN-MAN-6MG', at: { 'Flavor': 'Mango', 'Nicotine': '6mg' }, price: 250, stock: 3, reorder_level: 5 },
            { sku: 'CN-GRP-3MG', at: { 'Flavor': 'Grape', 'Nicotine': '3mg' }, price: 250, stock: 0, reorder_level: 5 }
          ]
        },
        {
          id: 2,
          name: 'VapeX Pro Pod System',
          cat: 'Devices',
          variants: [
            { sku: 'VX-BLK', at: { 'Flavor': 'Black' }, price: 1200, stock: 8, reorder_level: 3 },
            { sku: 'VX-SLV', at: { 'Flavor': 'Silver' }, price: 1200, stock: 2, reorder_level: 3 }
          ]
        },
        {
          id: 3,
          name: 'Mesh Replacement Coils 0.6Ω',
          cat: 'Coils',
          variants: [
            { sku: 'COIL-06', at: { 'Resistance': '0.6Ω' }, price: 150, stock: 25, reorder_level: 10 }
          ]
        }
      ],
      orders: [
        {
          order_no: 'ORD-1001',
          customer: 'John Customer',
          customer_email: 'customer@vapedesk.com',
          total: 500,
          status: 'Payment Verified',
          pickup_slot: 'Today, 4:00 PM',
          payment_method: 'GCash',
          gcash_ref: '123456789'
        }
      ],
      sales: [
        { receipt_no: 'REC-1001', total: 250, change: 50, date: new Date().toISOString() }
      ],
      audit: [
        { created_at: new Date().toLocaleString(), role: 'System', action: 'DB Seed', detail: 'Initialized mock database', ip: '127.0.0.1' }
      ]
    };
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } else {
    db = JSON.parse(db);
  }
  return db;
}

function saveDB(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function logAudit(role, action, detail) {
  const db = getDB();
  db.audit.unshift({
    created_at: new Date().toLocaleString(),
    role: role || 'Guest',
    action,
    detail,
    ip: '127.0.0.1'
  });
  saveDB(db);
}

/* ---------- APP STATE & CONSTANTS ---------- */
const $ = s => document.querySelector(s);
const peso = n => '₱' + Number(n).toLocaleString('en-PH', { minimumFractionDigits: 2 });
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

// picking search -mito
const S = { user: null, view: '', products: [], orders: [], my: [], dash: null, audit: [], pcart: [], ccart: [], open: {}, pay: 'Cash', cat: 'All', q: '', ageOk: false, mode: 'login' };
const ROLENAME = { admin: 'Admin', cashier: 'Cashier', custodian: 'Custodian', customer: 'Customer' };
const NAV = {
  admin: [['dashboard', 'Dashboard'], ['audit', 'Audit log'], ['inventory', 'Inventory (view)']],
  cashier: [['pos', 'Point of sale'], ['orders', 'Online orders'], ['audit', 'Audit log', 1]],
  custodian: [['inventory', 'Inventory'], ['audit', 'Audit log', 1]],
  customer: [['shop', 'Shop'], ['myorders', 'My orders']]
};

const ACCESS = { admin: ['dashboard', 'audit', 'inventory'], cashier: ['pos', 'orders'], custodian: ['inventory'], customer: ['shop', 'myorders'] };
const STEPS = ['Pending', 'Payment Verified', 'Ready for Pickup', 'Completed'];
const KEYS = { flavor: 'Flavor', size: 'Size', nicotine: 'Nicotine', resistance: 'Resistance' };

/* ---------- MOCK API REPLACEMENTS ---------- */
function api(action, body) {
  const db = getDB();

  if (action === 'me') {
    return { user: S.user };
  }

  if (action === 'login') {
    const u = db.users.find(x => x.email.toLowerCase() === body.email.toLowerCase() && x.password === body.password);
    if (!u) throw new Error('Invalid email or password.');
    logAudit(u.role, 'Login', `User ${u.email} logged in`);
    return { user: u };
  }

  if (action === 'register') {
    const exists = db.users.some(x => x.email.toLowerCase() === body.email.toLowerCase());
    if (exists) throw new Error('Email is already registered.');
    const newUser = { id: Date.now(), name: body.name, email: body.email, password: body.password, role: 'customer' };
    db.users.push(newUser);
    saveDB(db);
    logAudit('Customer', 'Register', `New account registered: ${body.email}`);
    return { ok: true };
  }

  if (action === 'logout') {
    if (S.user) logAudit(S.user.role, 'Logout', `User logged out`);
    return { ok: true };
  }

  if (action === 'products') {
    return db.products;
  }

  if (action === 'orders') {
    return db.orders;
  }

  if (action === 'my_orders') {
    return db.orders.filter(o => o.customer_email === S.user.email);
  }

  if (action === 'dashboard') {
    const todayStr = new Date().toDateString();
    const salesToday = db.sales.filter(s => new Date(s.date).toDateString() === todayStr).reduce((a, b) => a + b.total, 0);
    const lowStockCount = db.products.flatMap(p => p.variants).filter(v => v.stock <= v.reorder_level).length;
    const pendingOrders = db.orders.filter(o => o.status !== 'Completed' && o.status !== 'Cancelled').length;

    return {
      sales_today: salesToday,
      transactions: db.sales.length,
      pending_orders: pendingOrders,
      low_stock: lowStockCount,
      last_7_days: [
        { day: '2026-10-03', total: 1200 },
        { day: '2026-10-04', total: 2400 },
        { day: '2026-10-05', total: 1800 },
        { day: '2026-10-06', total: 3100 },
        { day: '2026-10-07', total: 2100 },
        { day: '2026-10-08', total: 1500 },
        { day: '2026-10-09', total: salesToday }
      ],
      top_variants: [
        { sku: 'CN-MAN-3MG', sold: 14 },
        { sku: 'VX-BLK', sold: 6 },
        { sku: 'COIL-06', sold: 19 }
      ]
    };
  }

  if (action === 'audit_log') {
    return db.audit;
  }

  if (action === 'sale') {
    body.items.forEach(item => {
      for (let p of db.products) {
        let v = p.variants.find(x => x.sku === item.sku);
        if (v) v.stock = Math.max(0, v.stock - item.qty);
      }
    });
    const totalAmt = body.items.reduce((a, i) => {
      const [, v] = findInDb(db, i.sku);
      return a + (v ? v.price * i.qty : 0);
    }, 0);

    const recNo = 'REC-' + Math.floor(1000 + Math.random() * 9000);
    const change = body.tendered ? body.tendered - totalAmt : 0;
    db.sales.push({ receipt_no: recNo, total: totalAmt, change, date: new Date().toISOString() });
    saveDB(db);
    logAudit(S.user.role, 'POS Sale', `Completed sale ${recNo} total ${peso(totalAmt)}`);
    return { receipt_no: recNo, total: totalAmt, change };
  }

  if (action === 'order_place') {
    const totalAmt = body.items.reduce((a, i) => {
      const [, v] = findInDb(db, i.sku);
      return a + (v ? v.price * i.qty : 0);
    }, 0);

    const orderNo = 'ORD-' + Math.floor(1000 + Math.random() * 9000);
    db.orders.unshift({
      order_no: orderNo,
      customer: S.user.name,
      customer_email: S.user.email,
      total: totalAmt,
      status: 'Pending',
      pickup_slot: body.pickup_slot,
      payment_method: body.payment_method,
      gcash_ref: body.gcash_ref || ''
    });
    saveDB(db);
    logAudit('Customer', 'Order Placed', `Placed order ${orderNo}`);
    return { order_no: orderNo };
  }

  if (action === 'order_update') {
    const o = db.orders.find(x => x.order_no === body.order_no);
    if (o) {
      if (body.to === 'cancel') {
        o.status = 'Cancelled';
      } else {
        const curr = STEPS.indexOf(o.status);
        if (curr < STEPS.length - 1) o.status = STEPS[curr + 1];
      }
      saveDB(db);
      logAudit(S.user.role, 'Order Updated', `Updated ${o.order_no} status to ${o.status}`);
    }
    return { ok: true };
  }

  if (action === 'stock_adjust') {
    const [, v] = findInDb(db, body.sku);
    if (v) {
      if (body.reason === 'Delivery') v.stock += body.qty;
      else v.stock = Math.max(0, v.stock - body.qty);
      saveDB(db);
      logAudit(S.user.role, 'Stock Adjusted', `Adjusted stock for ${body.sku} (${body.reason})`);
    }
    return { ok: true };
  }

  if (action === 'product_create') {
    const newId = Date.now();
    const variants = [];
    const attrKeys = Object.keys(body.attrs);

    function generateCombinations(index, current) {
      if (index === attrKeys.length) {
        const sku = body.name.substring(0, 3).toUpperCase() + '-' + Math.floor(100 + Math.random() * 900);
        variants.push({ sku, at: { ...current }, price: body.price, stock: body.stock, reorder_level: body.reorder });
        return;
      }
      const key = attrKeys[index];
      body.attrs[key].forEach(val => {
        generateCombinations(index + 1, { ...current, [key]: val });
      });
    }

    if (attrKeys.length > 0) generateCombinations(0, {});
    else variants.push({ sku: 'SKU-' + Math.floor(1000 + Math.random() * 9000), at: { 'Standard': 'Default' }, price: body.price, stock: body.stock, reorder_level: body.reorder });

    db.products.push({ id: newId, name: body.name, cat: body.category, variants });
    saveDB(db);
    logAudit(S.user.role, 'Product Created', `Added product ${body.name}`);
    return { variants: variants.length };
  }

  if (action === 'product_delete') {
    db.products = db.products.filter(p => p.id !== body.id);
    saveDB(db);
    logAudit(S.user.role, 'Product Deleted', `Removed product ID ${body.id}`);
    return { result: 'removed' };
  }

  if (action === 'price_set') {
    const [, v] = findInDb(db, body.sku);
    if (v) {
      v.price = body.price;
      saveDB(db);
      logAudit(S.user.role, 'Price Updated', `Updated price for ${body.sku} to ${body.price}`);
    }
    return { ok: true };
  }

  return {};
}

function findInDb(db, sku) {
  for (const p of db.products) {
    const v = p.variants.find(x => x.sku === sku);
    if (v) return [p, v];
  }
  return [null, null];
}

async function safe(fn) { try { await fn() } catch (e) { toast(e.message) } }

function norm(list) {
  return list.map(p => {
    const vs = p.variants.map(v => {
      const at = v.at || {};
      return { sku: v.sku, at, price: +v.price, stock: +v.stock, reorder: +v.reorder_level };
    });
    const attrs = {};
    vs.forEach(v => {
      for (const k in v.at) {
        attrs[k] = attrs[k] || [];
        if (!attrs[k].includes(v.at[k])) attrs[k].push(v.at[k]);
      }
    });
    return { id: +p.id, name: p.name, cat: p.cat, attrs, variants: vs };
  });
}

const loadProducts = async () => { S.products = norm(api('products')); };

async function load() {
  const v = S.view;
  if (['pos', 'shop', 'inventory'].includes(v)) await loadProducts();
  if (v === 'orders') S.orders = api('orders');
  if (v === 'myorders') S.my = api('my_orders');
  if (v === 'dashboard') S.dash = api('dashboard');
  if (v === 'audit' && S.user.role === 'admin') S.audit = api('audit_log');
}

/* ---------- UI HELPERS ---------- */
function toast(m) { const t = document.createElement('div'); t.className = 'toast'; t.textContent = m; document.body.append(t); setTimeout(() => t.remove(), 2600); }
function toggleTheme() { const d = document.documentElement; d.dataset.theme = d.dataset.theme === 'dark' ? '' : 'dark'; }
async function go(v) { S.view = v; await safe(load); render(); }
function modal(h) { $('#layer').innerHTML = html`<div class="modal" onclick="if(event.target===this)closeM()"><div class="card" role="dialog" aria-modal="true">${h}</div></div>`; }
function closeM() { $('#layer').innerHTML = ''; }
const vlabel = v => Object.values(v.at).join(' / ');
const stockBadge = n => n <= 0 ? '<span class="badge bad">Out</span>' : n <= 5 ? `<span class="badge warn">Low · ${n}</span>` : `<span class="badge ok">${n} left</span>`;
const total = p => p.variants.reduce((a, v) => a + v.stock, 0);
function find(sku) { for (const p of S.products) { const v = p.variants.find(x => x.sku === sku); if (v) return [p, v]; } return [null, null]; }

/* ---------- AUTH VIEW ---------- */
function vAuth() {
  const reg = S.mode === 'register';
  return html`
    <div class="card auth">
      <h2>${reg ? 'Create customer account' : 'Log in'}</h2>
      ${reg ? '<label for="n">Full name</label><input id="n" autocomplete="name">' : ''}
      <label for="e">Email</label><input id="e" type="email" autocomplete="email" placeholder="admin@vapedesk.com">
      <label for="pw">Password${reg ? ' (8+ characters)' : ''}</label><input id="pw" type="password" autocomplete="${reg ? 'new-password' : 'current-password'}" placeholder="admin123" onkeydown="if(event.key==='Enter')submitAuth()">
      <button class="p" style="width:100%;margin-top:16px" onclick="submitAuth()">${reg ? 'Sign up' : 'Log in'}</button>
      <button class="g" style="width:100%;margin-top:8px" onclick="S.mode='${reg ? 'login' : 'register'}';render()">${reg ? 'I already have an account' : 'New customer? Create an account'}</button>
      <div style="margin-top:15px; font-size:12px; color:var(--mute); line-height:1.4; border-top:1px solid var(--line); padding-top:10px;">
        <b>Demo Accounts:</b><br>
        Admin: admin@vapedesk.com | admin123<br>
        Cashier: cashier@vapedesk.com | cashier123<br>
        Custodian: custodian@vapedesk.com | custodian123<br>
        Customer: customer@vapedesk.com | customer123
      </div>
    </div>
  `;
}

function submitAuth() {
  safe(async () => {
    const email = $('#e').value.trim(), password = $('#pw').value;
    if (S.mode === 'register') {
      api('register', { name: $('#n').value, email, password });
      toast('Account created. Log in to continue.');
      S.mode = 'login';
      return render();
    }
    const d = api('login', { email, password });
    S.user = d.user;
    S.ageOk = false;
    await go(ACCESS[S.user.role][0]);
  });
}

function logout() {
  safe(async () => {
    api('logout', {});
    Object.assign(S, { user: null, view: '', pcart: [], ccart: [], mode: 'login' });
    render();
  });
}

/* ---------- VARIANT PICKER ---------- */

// added panel and search -mito
let pick = null;
function openPick(pid, target) {
  pick = { pid, target, sel: {}, openPanel: null, search: {} };
  drawPick();
}

const matches = (p, sel) => p.variants.filter(v => Object.entries(sel).every(([k, x]) => v.at[k] === x));

// ggawing drop down -mito
function drawPick() {
  const p = S.products.find(x => x.id === pick.pid);
  const keys = Object.keys(p.attrs);
  const full = keys.every(k => pick.sel[k]);
  const v = full && matches(p, pick.sel)[0];

  // combo box per ea atrerib -mito
  const combos = keys.map(k => {
    const chosen = pick.sel[k];
    const isOpen = pick.openPanel === k;
    return html`
      <div class="combo">
        <div class="combo-label">${esc(k)}</div>

        <!-- trigger button — looks like the "Pick a color" box -->
        <button type="button" class="combo-trigger" onclick="toggleCombo('${esc(k)}')">
          <span>${chosen ? esc(chosen) : `Pick a ${esc(k).toLowerCase()}…`}</span>
          <span class="caret">${isOpen ? '▴' : '▾'}</span>
        </button>

        <!-- panel that opens; search input lives INSIDE it -->
        <div class="combo-panel" id="panel-${esc(k)}" ${isOpen ? '' : 'hidden'}>
          <input class="combo-search"
                 placeholder="Search ${esc(k).toLowerCase()}…"
                 value="${esc(pick.search[k] || '')}"
                 oninput="filterCombo('${esc(k)}', this.value)"
                 onkeydown="comboKeydown(event,'${esc(k)}')"
                 autocomplete="off">
          <div class="combo-list" id="list-${esc(k)}">
            ${comboOptions(p, k)}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // modal pang wrapper -mito
  modal(
    `<h3>${esc(p.name)}</h3>` +
    combos +
    `<div class="line" style="margin-top:12px">
       <span>${v ? esc(vlabel(v)) : 'Choose every option'}</span>
       <span>${v ? peso(v.price) + ' ' + stockBadge(v.stock) : ''}</span>
     </div>
     <div class="row" style="margin-top:14px">
       <button onclick="closeM()">Cancel</button>
       <button class="p" ${v && v.stock > 0 ? '' : 'disabled'}
               data-sku="${v ? esc(v.sku) : ''}"
               onclick="addCart(this.dataset.sku)">Add to cart</button>
     </div>`
  );
}

/**
 * new helper function para sa drawpick
 **/

/* combo box helpers */

// alphabetical sila
function comboOptions(p, k) {
  const q = (pick.search[k] || '').toLowerCase();
  const opts = [...p.attrs[k]]
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }))
    .filter(val => val.toLowerCase().includes(q));

  if (!opts.length) return '<div class="combo-empty">No matches</div>';

  return opts.map(val => {
    const others = { ...pick.sel }; delete others[k];
    const ok = matches(p, { ...others, [k]: val }).some(x => x.stock > 0);
    const on = pick.sel[k] === val;
    return html`
      <div class="combo-opt ${on ? 'on' : ''} ${ok ? '' : 'dis'}"
           data-k="${esc(k)}" data-v="${esc(val)}"
           onmousedown="event.preventDefault()"
           onclick="selectCombo('${esc(k)}', this.dataset.v)">
        ${esc(val)}${on ? ' ✓' : ''}${ok ? '' : ' (out of stock)'}
      </div>
    `;
  }).join('');
}

// one pannel at a time
function toggleCombo(k) {
  pick.openPanel = pick.openPanel === k ? null : k;
  if (pick.openPanel === k) pick.search[k] = '';   // clear search on open
  drawPick();
  if (pick.openPanel === k) {
    const inp = document.querySelector(`#panel-${cssEsc(k)} .combo-search`);
    if (inp) inp.focus();
  }
}

// filter
function filterCombo(k, value) {
  pick.search[k] = value;
  const p = S.products.find(x => x.id === pick.pid);
  const list = document.getElementById('list-' + k);
  if (list) list.innerHTML = comboOptions(p, k);
}

// selection
function selectCombo(k, val) {
  pick.sel[k] = val;
  pick.openPanel = null;
  pick.search[k] = '';
  drawPick();
}

// Enter picks the first filtered match, Esc closes
function comboKeydown(e, k) {
  if (e.key === 'Escape') { pick.openPanel = null; drawPick(); return; }
  if (e.key === 'Enter') {
    e.preventDefault();
    const list = document.getElementById('list-' + k);
    const first = list && list.querySelector('.combo-opt:not(.dis)');
    if (first) selectCombo(k, first.dataset.v);
  }
}

// safe id selector (handles keys with spaces/special chars)
function cssEsc(s) { return s.replace(/([^\w-])/g, '\\$1'); }

// addcart option -mito
function addCart(sku) {
  const c = pick.target === 'pos' ? S.pcart : S.ccart, [, v] = find(sku), ex = c.find(x => x.sku === sku);
  if ((ex ? ex.qty : 0) + 1 > v.stock) return toast('Not enough stock');
  ex ? ex.qty++ : c.push({ sku, qty: 1 }); closeM(); render();
}

function chg(t, i, d) {
  const c = t === 'pos' ? S.pcart : S.ccart, x = c[i], [, v] = find(x.sku);
  if (x.qty + d > v.stock) return toast('Not enough stock'); x.qty += d; if (x.qty <= 0) c.splice(i, 1); render();
}

const sum = c => c.reduce((a, x) => a + find(x.sku)[1].price * x.qty, 0);
const snap = c => c.map(x => { const [p, v] = find(x.sku); return { name: p.name, v: vlabel(v), qty: x.qty, price: v.price }; });

function cartLines(c, t) {
  return c.length ? c.map((x, i) => {
    const [p, v] = find(x.sku);
    return html`
      <div class="line">
        <div><b>${esc(p.name)}</b><br><small style="color:var(--mute)">${esc(vlabel(v))} · ${peso(v.price)}</small></div>
        <div class="qty"><button aria-label="Less" onclick="chg('${t}',${i},-1)">−</button>${x.qty}<button aria-label="More" onclick="chg('${t}',${i},1)">+</button></div>
      </div>
    `;
  }).join('') : '<div class="empty">Cart is empty. Pick a product to start.</div>';
}

function catalog(t) {
  const cats = ['All', ...new Set(S.products.map(p => p.cat))];
  const list = S.products.filter(p => (S.cat === 'All' || p.cat === S.cat) && p.name.toLowerCase().includes(S.q.toLowerCase()));
  return html`
    <div class="chips">${cats.map(c => `<button class="chip ${S.cat === c ? 'on' : ''}" data-c="${esc(c)}" onclick="S.cat=this.dataset.c;render()">${esc(c)}</button>`).join('')}</div>
    <input id="q" placeholder="${t === 'pos' ? 'Scan barcode or search product' : 'Search products'}" value="${esc(S.q)}" oninput="S.q=this.value;render(true)" style="margin-bottom:12px">
    <div class="grid">${list.map(p => `<button class="card prod" onclick="openPick(${p.id},'${t}')"><b>${esc(p.name)}</b><span style="color:var(--mute)">From ${peso(Math.min(...p.variants.map(v => v.price)))}</span>${stockBadge(total(p))}</button>`).join('') || '<div class="empty">No products match.</div>'}</div>
  `;
}

/* ---------- POS ---------- */
function vPos() {
  const t = sum(S.pcart);
  return html`
    <h2>Point of sale</h2>
    <div class="pos">
      <div>${catalog('pos')}</div>
      <div class="card">
        <h3>Current sale</h3>
        ${cartLines(S.pcart, 'pos')}
        <div class="tot"><span>Total</span><span>${peso(t)}</span></div>
        <div class="chips">${['Cash', 'GCash'].map(m => `<button class="chip ${S.pay === m ? 'on' : ''}" onclick="S.pay='${m}';render()">${m}</button>`).join('')}</div>
        ${S.pay === 'Cash' ? `<input id="tend" type="number" min="0" placeholder="Amount tendered" oninput="chgAmt()"><p id="chg" style="color:var(--mute)">Change: ${peso(0)}</p>` : `<input id="ref" placeholder="GCash reference number">`}
        <div class="row"><button class="d" ${S.pcart.length ? '' : 'disabled'} onclick="voidSale()">Void</button><button class="p" ${S.pcart.length ? '' : 'disabled'} onclick="completeSale()">Complete sale</button></div>
      </div>
    </div>
  `;
}

function chgAmt() { const v = +$('#tend').value - sum(S.pcart); $('#chg').textContent = 'Change: ' + peso(v > 0 ? v : 0); }
function voidSale() { if (!confirm('Void this sale?')) return; S.pcart = []; render(); }

function completeSale() {
  safe(async () => {
    const lines = snap(S.pcart), t = sum(S.pcart);
    const body = { items: S.pcart.map(x => ({ sku: x.sku, qty: x.qty })), payment_method: S.pay };
    if (S.pay === 'Cash') body.tendered = +$('#tend').value; else body.gcash_ref = $('#ref').value.trim();
    const r = api('sale', body); S.pcart = []; await loadProducts(); render(); receipt(r, lines, t);
  });
}

function receipt(r, lines, t) {
  modal(html`
    <h3>Receipt ${esc(r.receipt_no)}</h3>
    <p style="color:var(--mute)">Vape Puffs, San Ildefonso, Bulacan<br>${new Date().toLocaleString()}</p>
    ${lines.map(l => `<div class="line"><span>${l.qty}×${esc(l.name)}<br><small>${esc(l.v)}</small></span><span>${peso(l.qty * l.price)}</span></div>`).join('')}
    <div class="tot"><span>Total</span><span>${peso(r.total)}</span></div>
    <p>Paid via ${S.pay}${S.pay === 'Cash' ? ' · Change ' + peso(r.change) : ''}</p>
    <div class="row noprint"><button onclick="closeM()">Close</button><button class="p" onclick="print()">Print</button></div>
  `);
}

/* ---------- CUSTOMER ---------- */
function vShop() {
  const t = sum(S.ccart);
  return html`
    <div class="hero"><h1>Vape Puffs</h1><div>E-liquids, pods, coils and disposables. Reserve online and pick up in store at San Ildefonso, Bulacan.</div></div>
    <div class="pos">
      <div>${catalog('shop')}</div>
      <div class="card">
        <h3>Your cart</h3>
        ${cartLines(S.ccart, 'shop')}
        <div class="tot"><span>Total</span><span>${peso(t)}</span></div>
        <button class="p" style="width:100%" ${S.ccart.length ? '' : 'disabled'} onclick="checkout()">Checkout for pickup</button>
      </div>
    </div>
  `;
}

function checkout() {
  modal(html`
    <h3>Pickup checkout</h3>
    <label>Pickup time</label><select id="slot"><option>Today, 4:00 PM</option><option>Today, 6:00 PM</option><option>Tomorrow, 10:00 AM</option></select>
    <label style="display:block;margin-top:10px">Payment</label><select id="pm" onchange="$('#gc').style.display=this.value==='GCash'?'block':'none'"><option>Pay at store</option><option>GCash</option></select>
    <div id="gc" style="display:none;margin-top:10px"><p style="color:var(--mute)">Send ${peso(sum(S.ccart))} to the store GCash number, then enter the reference number. Staff will verify it.</p><input id="cref" placeholder="GCash reference number"></div>
    <p class="badge warn" style="margin-top:12px">Bring a valid ID showing you are 18 or older. Staff will check it at pickup.</p>
    <div class="row"><button onclick="closeM()">Cancel</button><button class="p" onclick="placeOrder()">Place order</button></div>
  `);
}

function placeOrder() {
  safe(async () => {
    const r = api('order_place', { items: S.ccart.map(x => ({ sku: x.sku, qty: x.qty })), pickup_slot: $('#slot').value, payment_method: $('#pm').value, gcash_ref: $('#cref').value.trim() });
    S.ccart = []; closeM(); toast('Order ' + r.order_no + ' placed'); go('myorders');
  });
}

const stBadge = s => `<span class="badge ${s === 'Cancelled' ? 'bad' : s === 'Completed' ? 'ok' : ''}">${esc(s)}</span>`;

function vMy() {
  return html`
    <h2>My orders</h2>
    ${S.my.length ? S.my.map(o => {
      const i = STEPS.indexOf(o.status);
      return html`
        <div class="card" style="margin-bottom:12px">
          <div class="line" style="border:0"><b>${esc(o.order_no)}</b>${stBadge(o.status)}</div>
          <div class="steps">${STEPS.map((s, j) => `<span class="badge ${o.status !== 'Cancelled' && j <= i ? 'ok' : ''}">${s}</span>`).join('')}</div>
          <p style="color:var(--mute)">Pickup: ${esc(o.pickup_slot)} · ${esc(o.payment_method)} · ${peso(o.total)}</p>
        </div>
      `;
    }).join('') : '<div class="empty">No orders yet. Browse the shop to place one.</div>'}
  `;
}

/* ---------- CASHIER ---------- */
function vOrders() {
  const act = ['Verify payment', 'Mark ready', 'Complete pickup'];
  return html`
    <h2>Online orders</h2>
    <div class="card wrap">
      ${S.orders.length ? `<table><tr><th>Order</th><th>Customer</th><th>Pay</th><th>Total</th><th>Status</th><th>Action</th></tr>` +
        S.orders.map(o => {
          const i = STEPS.indexOf(o.status), closed = i < 0 || i === 3;
          return html`
            <tr>
              <td>${esc(o.order_no)}<br><small>${esc(o.pickup_slot)}</small></td>
              <td>${esc(o.customer)}</td>
              <td>${esc(o.payment_method)}${o.gcash_ref ? '<br><small>Ref ' + esc(o.gcash_ref) + '</small>' : ''}</td>
              <td>${peso(o.total)}</td>
              <td>${stBadge(o.status)}</td>
              <td>${closed ? '—' : `<button class="p" data-no="${esc(o.order_no)}" onclick="upd(this.dataset.no,'next')">${act[i]}</button> <button class="d" data-no="${esc(o.order_no)}" onclick="upd(this.dataset.no,'cancel')">Cancel</button>`}</td>
            </tr>
          `;
        }).join('') + '</table>'
      : '<div class="empty">No online orders yet.</div>'}
    </div>
  `;
}

function upd(no, to) {
  if (to === 'cancel' && !confirm('Cancel ' + no + '? Stock will be restored.')) return;
  safe(async () => { api('order_update', { order_no: no, to }); S.orders = api('orders'); render(); });
}

/* ---------- CUSTODIAN ---------- */
function vInv() {
  const ro = S.user.role === 'admin', low = S.products.flatMap(p => p.variants.filter(v => v.stock <= v.reorder).map(v => [p, v]));
  return html`
    <div class="row" style="align-items:center;margin-bottom:12px">
      <h2 style="margin:0">Inventory</h2>
      ${ro ? '' : '<button class="p" style="flex:0 0 auto" onclick="productForm()">+ Add product</button>'}
    </div>
    <div class="row" style="align-items:start">
      <div class="card wrap" style="flex:3;min-width:300px">
        <table>
          <tr><th>Product</th><th>Category</th><th>Variants</th><th>Stock</th></tr>
          ${S.products.map(p => `
            <tr style="cursor:pointer" onclick="S.open[${p.id}]=!S.open[${p.id}];render()">
              <td><b>${S.open[p.id] ? '▾' : '▸'} ${esc(p.name)}</b></td>
              <td>${esc(p.cat)}</td>
              <td>${p.variants.length}</td>
              <td>${stockBadge(total(p))}${ro ? '' : ` <button class="d" style="min-height:32px;padding:2px 10px" onclick="event.stopPropagation();delProduct(${p.id})">Delete</button>`}</td>
            </tr>` +
            (S.open[p.id] ? p.variants.map(v => html`
              <tr style="background:var(--bg)">
                <td style="padding-left:30px">${esc(vlabel(v))}<br><small style="color:var(--mute)">${esc(v.sku)}</small></td>
                <td>${peso(v.price)}</td>
                <td>${stockBadge(v.stock)}</td>
                <td>${ro ? '' : `<button data-sku="${esc(v.sku)}" onclick="stockForm(this.dataset.sku)">Update stock</button> <button data-sku="${esc(v.sku)}" onclick="priceForm(this.dataset.sku)">Edit price</button>`}</td>
              </tr>
            `).join('') : '')
          ).join('')}
        </table>
      </div>
      <div class="card" style="flex:1">
        <h3>Low-stock alerts (${low.length})</h3>
        ${low.slice(0, 12).map(([p, v]) => `<div class="line"><span>${esc(p.name)}<br><small>${esc(vlabel(v))}</small></span>${stockBadge(v.stock)}</div>`).join('') || '<div class="empty">All variants are stocked.</div>'}
      </div>
    </div>
  `;
}

function stockForm(sku) {
  const [p, v] = find(sku);
  modal(html`
    <h3>Update stock</h3>
    <p>${esc(p.name)}<br><small>${esc(vlabel(v))} · currently ${v.stock}</small></p>
    <label>Reason</label><select id="why"><option>Delivery</option><option>Damage</option><option>Recount</option><option>Shrinkage</option></select>
    <label style="display:block;margin-top:10px">Quantity</label><input id="sq" type="number" min="1" value="1">
    <p style="color:var(--mute)">Delivery adds stock. Other reasons remove it.</p>
    <div class="row"><button onclick="closeM()">Cancel</button><button class="p" data-sku="${esc(sku)}" onclick="saveStock(this.dataset.sku)">Save</button></div>
  `);
}

function saveStock(sku) { safe(async () => { api('stock_adjust', { sku, reason: $('#why').value, qty: +$('#sq').value }); closeM(); await loadProducts(); render(); }); }

const lbl = t => `<label style="display:block;margin:10px 0 4px;color:var(--mute)">${t}</label>`;
const PH = { Flavor: 'Mango, Menthol, Grape', Size: '30ml, 60ml', Nicotine: '3mg, 6mg, 24mg', Resistance: '0.6Ω, 0.8Ω' };
const listOf = t => [...new Set(t.split(',').map(x => x.trim()).filter(Boolean))];

function productForm() {
  modal(html`
    <h3>Add product</h3>
    ${lbl('Product name')}<input id="pn" placeholder="e.g. Cloud Nine E-Liquid">
    ${lbl('Category')}<input id="pc" list="cats" placeholder="e.g. E-liquids"><datalist id="cats">${[...new Set(S.products.map(p => p.cat))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="row">
      <div>${lbl('Price (₱)')}<input id="pp" type="number" min="0" step="0.01"></div>
      <div>${lbl('Stock per variant')}<input id="ps" type="number" min="0" value="0"></div>
      <div>${lbl('Reorder level')}<input id="pr" type="number" min="0" value="5"></div>
    </div>
    <p style="color:var(--mute);margin:12px 0 0">Options: separate values with commas. Leave a box empty if it doesn't apply. Every combination becomes its own variant.</p>
    ${Object.keys(PH).map(k => lbl(k) + `<input class="at" data-k="${k}" placeholder="${PH[k]}" oninput="countV()">`).join('')}
    <p id="vc" class="badge" style="margin-top:12px">Creates 1 variant</p>
    <div class="row"><button onclick="closeM()">Cancel</button><button class="p" onclick="saveProduct()">Save product</button></div>
  `);
}

function countV() { let n = 1; document.querySelectorAll('.at').forEach(i => { const l = listOf(i.value).length; if (l) n *= l; }); $('#vc').textContent = 'Creates ' + n + ' variant' + (n > 1 ? 's' : ''); }

function saveProduct() {
  safe(async () => {
    const attrs = {}; document.querySelectorAll('.at').forEach(i => { const l = listOf(i.value); if (l.length) attrs[i.dataset.k] = l; });
    const r = api('product_create', { name: $('#pn').value, category: $('#pc').value, price: +$('#pp').value, stock: +$('#ps').value, reorder: +$('#pr').value, attrs });
    closeM(); await loadProducts(); render(); toast('Product added with ' + r.variants + ' variant' + (r.variants > 1 ? 's' : ''));
  });
}

function delProduct(id) {
  const p = S.products.find(x => x.id === id);
  if (!confirm('Delete "' + p.name + '"?')) return;
  safe(async () => { const r = api('product_delete', { id }); await loadProducts(); render(); toast('Product deleted'); });
}

function priceForm(sku) {
  const [p, v] = find(sku);
  modal(html`
    <h3>Edit price</h3>
    <p>${esc(p.name)}<br><small>${esc(vlabel(v))} · currently ${peso(v.price)}</small></p>
    ${lbl('New price (₱)')}<input id="np" type="number" min="0" step="0.01" value="${v.price}">
    <div class="row"><button onclick="closeM()">Cancel</button><button class="p" data-sku="${esc(sku)}" onclick="savePrice(this.dataset.sku)">Save</button></div>
  `);
}

function savePrice(sku) { safe(async () => { api('price_set', { sku, price: +$('#np').value }); closeM(); await loadProducts(); render(); }); }

/* ---------- ADMIN ---------- */
function vDash() {
  const d = S.dash, days = d.last_7_days, mx = Math.max(1, ...days.map(x => +x.total));
  return html`
    <h2>Dashboard</h2>
    <div class="row">
      <div class="card kpi"><span>Today's sales</span><b>${peso(d.sales_today)}</b></div>
      <div class="card kpi"><span>Transactions</span><b>${d.transactions}</b></div>
      <div class="card kpi"><span>Online orders pending</span><b>${d.pending_orders}</b></div>
      <div class="card kpi"><span>Low-stock variants</span><b>${d.low_stock}</b></div>
    </div>
    <div class="row" style="margin-top:12px">
      <div class="card" style="flex:2">
        <h3>Sales, last 7 days</h3>
        ${days.length ? `<div class="bars" style="margin-bottom:24px">${days.map(x => `<div style="height:${Math.max(x.total / mx * 100, 3)}%" title="${peso(x.total)}"><span>${esc(x.day.slice(5))}</span></div>`).join('')}</div>` : '<div class="empty">No sales recorded yet.</div>'}
      </div>
      <div class="card">
        <h3>Top variants today</h3>
        ${d.top_variants.map(t => `<div class="line"><span>${esc(t.sku)}</span><b>${t.sold}</b></div>`).join('') || '<div class="empty">Complete a sale in the POS to see results.</div>'}
      </div>
    </div>
  `;
}

function vAudit() {
  return html`
    <h2>Audit log</h2>
    <div class="card wrap">
      ${S.audit.length ? `<table><tr><th>Time</th><th>Role</th><th>Action</th><th>Details</th><th>IP</th></tr>` +
        S.audit.map(a => `<tr><td>${esc(a.created_at)}</td><td>${esc(a.role)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td><td>${esc(a.ip)}</td></tr>`).join('') + '</table>'
      : '<div class="empty">No activity recorded yet.</div>'}
    </div>
  `;
}

const restricted = () => html`
  <div class="card empty">
    <h2>Restricted</h2>
    The ${ROLENAME[S.user.role]} role can't open this page. Log in as a Store Administrator to view it.
  </div>
`;

/* ---------- MAIN RENDER ---------- */
function render(keepFocus) {
  const u = S.user;
  $('#app').classList.toggle('anon', !u);
  $('#out').style.display = u ? '' : 'none';
  $('#who').textContent = u ? u.name + ' · ' + ROLENAME[u.role] : '';

  if (!u) { $('#nav').innerHTML = ''; $('#main').innerHTML = vAuth(); return; }

  $('#nav').innerHTML = '<small>' + ROLENAME[u.role] + '</small>' + NAV[u.role].map(([id, l, lock]) => `<button class="${S.view === id ? 'on' : ''}" onclick="go('${id}')">${lock ? '🔒 ' : ''}${l}</button>`).join('');

  const V = { pos: vPos, orders: vOrders, inventory: vInv, dashboard: vDash, audit: vAudit, shop: vShop, myorders: vMy };
  const ok = ACCESS[u.role].includes(S.view), pos = document.activeElement && document.activeElement.id === 'q' ? document.activeElement.selectionStart : 0;
  $('#main').innerHTML = ok ? V[S.view]() : restricted();
  if (keepFocus && $('#q')) { $('#q').focus(); $('#q').setSelectionRange(pos, pos); }
  if (u.role === 'customer' && !S.ageOk && !$('#layer').innerHTML) ageGate();
}

function ageGate() {
  modal(html`
    <h3>Age check</h3>
    <p>You must be 18 or older to enter this site.</p>
    <div class="row"><button onclick="logout();closeM()">Exit</button><button class="p" onclick="S.ageOk=true;closeM()">I am 18 or older</button></div>
  `);
}

/* ---------- INITIALIZE ---------- */
(async () => {
  try {
    getDB(); // initialize storage
    const d = api('me');
    if (d.user) { S.user = d.user; S.ageOk = false; S.view = ACCESS[d.user.role][0]; await load(); }
  } catch (e) { toast('Error initializing application.'); }
  render();
})();