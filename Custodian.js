/* ----------


CUSTODIAN



---------- */

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
          ${S.products.map(p => html`
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
    <label>Reason</label>
    <select id="why">
      <option>Delivery</option>
      <option>Damage</option>
      <option>Recount</option>
      <option>Shrinkage</option>
    </select>
    <label style="display:block;margin-top:10px">Quantity</label>
    <input id="sq" type="number" min="1" value="1">
    <p style="color:var(--mute)">Delivery adds stock. Other reasons remove it.</p>
    <div class="row">
      <button onclick="closeM()">Cancel</button>
      <button class="p" data-sku="${esc(sku)}" onclick="saveStock(this.dataset.sku)">Save</button>
    </div>
  `);
}

function saveStock(sku) {
  safe(async () => {
    api('stock_adjust', { sku, reason: $('#why').value, qty: +$('#sq').value });
    closeM();
    await loadProducts();
    render();
  });
}

const lbl = t => `<label style="display:block;margin:10px 0 4px;color:var(--mute)">${t}</label>`;
const PH = { Flavor: 'Mango, Menthol, Grape', Size: '30ml, 60ml', Nicotine: '3mg, 6mg, 24mg', Resistance: '0.6Ω, 0.8Ω' };
const listOf = t => [...new Set(t.split(',').map(x => x.trim()).filter(Boolean))];

function productForm() {
  modal(html`
    <h3>Add product</h3>
    ${lbl('Product name')}
    <input id="pn" placeholder="e.g. Cloud Nine E-Liquid">
    ${lbl('Category')}
    <input id="pc" list="cats" placeholder="e.g. E-liquids">
    <datalist id="cats">${[...new Set(S.products.map(p => p.cat))].map(c => `<option value="${esc(c)}">`).join('')}</datalist>
    <div class="row">
      <div>${lbl('Price (₱)')}<input id="pp" type="number" min="0" step="0.01"></div>
      <div>${lbl('Stock per variant')}<input id="ps" type="number" min="0" value="0"></div>
      <div>${lbl('Reorder level')}<input id="pr" type="number" min="0" value="5"></div>
    </div>
    <p style="color:var(--mute);margin:12px 0 0">Options: separate values with commas. Leave a box empty if it doesn't apply. Every combination becomes its own variant.</p>
    ${Object.keys(PH).map(k => lbl(k) + `<input class="at" data-k="${k}" placeholder="${PH[k]}" oninput="countV()">`).join('')}
    <p id="vc" class="badge" style="margin-top:12px">Creates 1 variant</p>
    <div class="row">
      <button onclick="closeM()">Cancel</button>
      <button class="p" onclick="saveProduct()">Save product</button>
    </div>
  `);
}

function countV() {
  let n = 1;
  document.querySelectorAll('.at').forEach(i => {
    const l = listOf(i.value).length;
    if (l) n *= l;
  });
  $('#vc').textContent = 'Creates ' + n + ' variant' + (n > 1 ? 's' : '');
}

function saveProduct() {
  safe(async () => {
    const attrs = {};
    document.querySelectorAll('.at').forEach(i => {
      const l = listOf(i.value);
      if (l.length) attrs[i.dataset.k] = l;
    });
    const r = api('product_create', { name: $('#pn').value, category: $('#pc').value, price: +$('#pp').value, stock: +$('#ps').value, reorder: +$('#pr').value, attrs });
    closeM();
    await loadProducts();
    render();
    toast('Product added with ' + r.variants + ' variant' + (r.variants > 1 ? 's' : ''));
  });
}

function delProduct(id) {
  const p = S.products.find(x => x.id === id);
  if (!confirm('Delete "' + p.name + '"?')) return;
  safe(async () => {
    const r = api('product_delete', { id });
    await loadProducts();
    render();
    toast('Product deleted');
  });
}

function priceForm(sku) {
  const [p, v] = find(sku);
  modal(html`
    <h3>Edit price</h3>
    <p>${esc(p.name)}<br><small>${esc(vlabel(v))} · currently ${peso(v.price)}</small></p>
    ${lbl('New price (₱)')}
    <input id="np" type="number" min="0" step="0.01" value="${v.price}">
    <div class="row">
      <button onclick="closeM()">Cancel</button>
      <button class="p" data-sku="${esc(sku)}" onclick="savePrice(this.dataset.sku)">Save</button>
    </div>
  `);
}

function savePrice(sku) {
  safe(async () => {
    api('price_set', { sku, price: +$('#np').value });
    closeM();
    await loadProducts();
    render();
  });
}