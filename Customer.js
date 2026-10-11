/* ----------


CUSTOMER



---------- */

function vShop() {
  const t = sum(S.ccart);
  return html`
    <div class="hero">
      <h1>Vape Puffs</h1>
      <div>E-liquids, pods, coils and disposables. Reserve online and pick up in store at San Ildefonso, Bulacan.</div>
    </div>
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
    <label>Pickup time</label>
    <select id="slot">
      <option>Today, 4:00 PM</option>
      <option>Today, 6:00 PM</option>
      <option>Tomorrow, 10:00 AM</option>
    </select>
    <label style="display:block;margin-top:10px">Payment</label>
    <select id="pm" onchange="$('#gc').style.display=this.value==='GCash'?'block':'none'">
      <option>Pay at store</option>
      <option>GCash</option>
    </select>
    <div id="gc" style="display:none;margin-top:10px">
      <p style="color:var(--mute)">Send ${peso(sum(S.ccart))} to the store GCash number, then enter the reference number. Staff will verify it.</p>
      <input id="cref" placeholder="GCash reference number">
    </div>
    <p class="badge warn" style="margin-top:12px">Bring a valid ID showing you are 18 or older. Staff will check it at pickup.</p>
    <div class="row">
      <button onclick="closeM()">Cancel</button>
      <button class="p" onclick="placeOrder()">Place order</button>
    </div>
  `);
}

function placeOrder() {
  safe(async () => {
    const r = api('order_place', { items: S.ccart.map(x => ({ sku: x.sku, qty: x.qty })), pickup_slot: $('#slot').value, payment_method: $('#pm').value, gcash_ref: $('#cref').value.trim() });
    S.ccart = [];
    closeM();
    toast('Order ' + r.order_no + ' placed');
    go('myorders');
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