/* ----------


POS



---------- */

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
        <div class="chips">
          ${['Cash', 'GCash'].map(m => `<button class="chip ${S.pay === m ? 'on' : ''}" onclick="S.pay='${m}';render()">${m}</button>`).join('')}
        </div>
        ${S.pay === 'Cash' ? `<input id="tend" type="number" min="0" placeholder="Amount tendered" oninput="chgAmt()"><p id="chg" style="color:var(--mute)">Change: ${peso(0)}</p>` : `<input id="ref" placeholder="GCash reference number">`}
        <div class="row">
          <button class="d" ${S.pcart.length ? '' : 'disabled'} onclick="voidSale()">Void</button>
          <button class="p" ${S.pcart.length ? '' : 'disabled'} onclick="completeSale()">Complete sale</button>
        </div>
      </div>
    </div>
  `;
}

function chgAmt() {
  const v = +$('#tend').value - sum(S.pcart);
  $('#chg').textContent = 'Change: ' + peso(v > 0 ? v : 0);
}

function voidSale() {
  if (!confirm('Void this sale?')) return;
  S.pcart = [];
  render();
}

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

/* ---------- ONLINE ORDERS ---------- */

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

  safe(async () => {
    api('order_update', { order_no: no, to });
    S.orders = api('orders');
    render();
  });
}