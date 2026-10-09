const API='backend/api.php';
const $=s=>document.querySelector(s),peso=n=>'₱'+Number(n).toLocaleString('en-PH',{minimumFractionDigits:2});
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const S={user:null,view:'',products:[],orders:[],my:[],dash:null,audit:[],pcart:[],ccart:[],open:{},pay:'Cash',cat:'All',q:'',ageOk:false,mode:'login'};
const ROLENAME={admin:'Admin',cashier:'Cashier',custodian:'Custodian',customer:'Customer'};
const NAV={admin:[['dashboard','Dashboard'],['audit','Audit log'],['inventory','Inventory (view)']],
 cashier:[['pos','Point of sale'],['orders','Online orders'],['audit','Audit log',1]],
 custodian:[['inventory','Inventory'],['audit','Audit log',1]],
 customer:[['shop','Shop'],['myorders','My orders']]};
const ACCESS={admin:['dashboard','audit','inventory'],cashier:['pos','orders'],custodian:['inventory'],customer:['shop','myorders']};
const STEPS=['Pending','Payment Verified','Ready for Pickup','Completed'];
const KEYS={flavor:'Flavor',size:'Size',nicotine:'Nicotine',resistance:'Resistance'};

/* ---------- API ---------- */
async function api(action,body){
  const r=await fetch(API+'?action='+action,{method:body?'POST':'GET',credentials:'same-origin',
    headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined});
  const d=await r.json().catch(()=>({error:'The server sent an unreadable response.'}));
  if(!r.ok)throw new Error(d.error||'Request failed');
  return d}
async function safe(fn){try{await fn()}catch(e){toast(e.message)}}
function norm(list){return list.map(p=>{
  const vs=p.variants.map(v=>{const at={};for(const k in KEYS)if(v[k]!=null)at[KEYS[k]]=v[k];return{sku:v.sku,at,price:+v.price,stock:+v.stock,reorder:+v.reorder_level}});
  const attrs={};vs.forEach(v=>{for(const k in v.at){attrs[k]=attrs[k]||[];if(!attrs[k].includes(v.at[k]))attrs[k].push(v.at[k])}});
  return{id:+p.id,name:p.name,cat:p.category,attrs,variants:vs}})}
const loadProducts=async()=>{S.products=norm(await api('products'))};
async function load(){
  const v=S.view;
  if(['pos','shop','inventory'].includes(v))await loadProducts();
  if(v==='orders')S.orders=await api('orders');
  if(v==='myorders')S.my=await api('my_orders');
  if(v==='dashboard')S.dash=await api('dashboard');
  if(v==='audit'&&S.user.role==='admin')S.audit=await api('audit_log')}

/* ---------- helpers ---------- */
const log=()=>{};
function toast(m){const t=document.createElement('div');t.className='toast';t.textContent=m;document.body.append(t);setTimeout(()=>t.remove(),2600)}
function toggleTheme(){const d=document.documentElement;d.dataset.theme=d.dataset.theme==='dark'?'':'dark'}
async function go(v){S.view=v;await safe(load);render()}
function modal(h){$('#layer').innerHTML=`<div class="modal" onclick="if(event.target===this)closeM()"><div class="card" role="dialog" aria-modal="true">${h}</div></div>`}
function closeM(){$('#layer').innerHTML=''}
const vlabel=v=>Object.values(v.at).join(' / ');
const stockBadge=n=>n<=0?'<span class="badge bad">Out</span>':n<=5?`<span class="badge warn">Low · ${n}</span>`:`<span class="badge ok">${n} left</span>`;
const total=p=>p.variants.reduce((a,v)=>a+v.stock,0);
function find(sku){for(const p of S.products){const v=p.variants.find(x=>x.sku===sku);if(v)return[p,v]}return[null,null]}

/* ---------- auth ---------- */
function vAuth(){const reg=S.mode==='register';return`<div class="card auth"><h2>${reg?'Create customer account':'Log in'}</h2>
 ${reg?'<label for="n">Full name</label><input id="n" autocomplete="name">':''}
 <label for="e">Email</label><input id="e" type="email" autocomplete="email">
 <label for="pw">Password${reg?' (8+ characters)':''}</label><input id="pw" type="password" autocomplete="${reg?'new-password':'current-password'}" onkeydown="if(event.key==='Enter')submitAuth()">
 <button class="p" style="width:100%;margin-top:16px" onclick="submitAuth()">${reg?'Sign up':'Log in'}</button>
 <button class="g" style="width:100%;margin-top:8px" onclick="S.mode='${reg?'login':'register'}';render()">${reg?'I already have an account':'New customer? Create an account'}</button></div>`}
function submitAuth(){safe(async()=>{
  const email=$('#e').value.trim(),password=$('#pw').value;
  if(S.mode==='register'){await api('register',{name:$('#n').value,email,password});toast('Account created. Log in to continue.');S.mode='login';return render()}
  const d=await api('login',{email,password});S.user=d.user;S.ageOk=false;await go(ACCESS[S.user.role][0])})}
function logout(){safe(async()=>{await api('logout',{});Object.assign(S,{user:null,view:'',pcart:[],ccart:[],mode:'login'});render()})}

/* ---------- variant picker ---------- */
let pick=null;
function openPick(pid,target){pick={pid,target,sel:{}};drawPick()}
const matches=(p,sel)=>p.variants.filter(v=>Object.entries(sel).every(([k,x])=>v.at[k]===x));
function drawPick(){
  const p=S.products.find(x=>x.id===pick.pid),keys=Object.keys(p.attrs);
  const full=keys.every(k=>pick.sel[k]),v=full&&matches(p,pick.sel)[0];
  modal(`<h3>${esc(p.name)}</h3>`+keys.map(k=>`<div style="margin-bottom:6px;color:var(--mute)">${esc(k)}</div><div class="chips">`+p.attrs[k].map((val,i)=>{
    const others={...pick.sel};delete others[k];const ok=matches(p,{...others,[k]:val}).some(x=>x.stock>0);
    return`<button class="chip ${pick.sel[k]===val?'on':''}" ${ok?'':'disabled title="Out of stock for this combination"'} data-k="${esc(k)}" data-v="${esc(val)}" onclick="pick.sel[this.dataset.k]=this.dataset.v;drawPick()">${esc(val)}</button>`}).join('')+'</div>').join('')+
  `<div class="line"><span>${v?esc(vlabel(v)):'Choose every option'}</span><span>${v?peso(v.price)+' '+stockBadge(v.stock):''}</span></div>
   <div class="row" style="margin-top:14px"><button onclick="closeM()">Cancel</button><button class="p" ${v&&v.stock>0?'':'disabled'} data-sku="${v?esc(v.sku):''}" onclick="addCart(this.dataset.sku)">Add to cart</button></div>`)}
function addCart(sku){
  const c=pick.target==='pos'?S.pcart:S.ccart,[,v]=find(sku),ex=c.find(x=>x.sku===sku);
  if((ex?ex.qty:0)+1>v.stock)return toast('Not enough stock');
  ex?ex.qty++:c.push({sku,qty:1});closeM();render()}
function chg(t,i,d){const c=t==='pos'?S.pcart:S.ccart,x=c[i],[,v]=find(x.sku);
  if(x.qty+d>v.stock)return toast('Not enough stock');x.qty+=d;if(x.qty<=0)c.splice(i,1);render()}
const sum=c=>c.reduce((a,x)=>a+find(x.sku)[1].price*x.qty,0);
const snap=c=>c.map(x=>{const[p,v]=find(x.sku);return{name:p.name,v:vlabel(v),qty:x.qty,price:v.price}});
function cartLines(c,t){return c.length?c.map((x,i)=>{const[p,v]=find(x.sku);return`<div class="line"><div><b>${esc(p.name)}</b><br><small style="color:var(--mute)">${esc(vlabel(v))} · ${peso(v.price)}</small></div>
 <div class="qty"><button aria-label="Less" onclick="chg('${t}',${i},-1)">−</button>${x.qty}<button aria-label="More" onclick="chg('${t}',${i},1)">+</button></div></div>`}).join(''):'<div class="empty">Cart is empty. Pick a product to start.</div>'}
function catalog(t){
  const cats=['All',...new Set(S.products.map(p=>p.cat))];
  const list=S.products.filter(p=>(S.cat==='All'||p.cat===S.cat)&&p.name.toLowerCase().includes(S.q.toLowerCase()));
  return`<div class="chips">${cats.map(c=>`<button class="chip ${S.cat===c?'on':''}" data-c="${esc(c)}" onclick="S.cat=this.dataset.c;render()">${esc(c)}</button>`).join('')}</div>
  <input id="q" placeholder="${t==='pos'?'Scan barcode or search product':'Search products'}" value="${esc(S.q)}" oninput="S.q=this.value;render(true)" style="margin-bottom:12px">
  <div class="grid">${list.map(p=>`<button class="card prod" onclick="openPick(${p.id},'${t}')"><b>${esc(p.name)}</b><span style="color:var(--mute)">From ${peso(Math.min(...p.variants.map(v=>v.price)))}</span>${stockBadge(total(p))}</button>`).join('')||'<div class="empty">No products match.</div>'}</div>`}

/* ---------- POS ---------- */
function vPos(){const t=sum(S.pcart);return`<h2>Point of sale</h2><div class="pos"><div>${catalog('pos')}</div>
 <div class="card"><h3>Current sale</h3>${cartLines(S.pcart,'pos')}<div class="tot"><span>Total</span><span>${peso(t)}</span></div>
 <div class="chips">${['Cash','GCash'].map(m=>`<button class="chip ${S.pay===m?'on':''}" onclick="S.pay='${m}';render()">${m}</button>`).join('')}</div>
 ${S.pay==='Cash'?`<input id="tend" type="number" min="0" placeholder="Amount tendered" oninput="chgAmt()"><p id="chg" style="color:var(--mute)">Change: ${peso(0)}</p>`:`<input id="ref" placeholder="GCash reference number">`}
 <div class="row"><button class="d" ${S.pcart.length?'':'disabled'} onclick="voidSale()">Void</button><button class="p" ${S.pcart.length?'':'disabled'} onclick="completeSale()">Complete sale</button></div></div></div>`}
function chgAmt(){const v=+$('#tend').value-sum(S.pcart);$('#chg').textContent='Change: '+peso(v>0?v:0)}
function voidSale(){if(!confirm('Void this sale?'))return;S.pcart=[];render()}
function completeSale(){safe(async()=>{
  const lines=snap(S.pcart),t=sum(S.pcart);
  const body={items:S.pcart.map(x=>({sku:x.sku,qty:x.qty})),payment_method:S.pay};
  if(S.pay==='Cash')body.tendered=+$('#tend').value;else body.gcash_ref=$('#ref').value.trim();
  const r=await api('sale',body);S.pcart=[];await loadProducts();render();receipt(r,lines,t)})}
function receipt(r,lines,t){modal(`<h3>Receipt ${esc(r.receipt_no)}</h3><p style="color:var(--mute)">Vape Puffs, San Ildefonso, Bulacan<br>${new Date().toLocaleString()}</p>
 ${lines.map(l=>`<div class="line"><span>${l.qty}× ${esc(l.name)}<br><small>${esc(l.v)}</small></span><span>${peso(l.qty*l.price)}</span></div>`).join('')}
 <div class="tot"><span>Total</span><span>${peso(r.total)}</span></div><p>Paid via ${S.pay}${S.pay==='Cash'?' · Change '+peso(r.change):''}</p>
 <div class="row noprint"><button onclick="closeM()">Close</button><button class="p" onclick="print()">Print</button></div>`)}

/* ---------- Customer ---------- */
function vShop(){const t=sum(S.ccart);return`<div class="hero"><h1>Vape Puffs</h1><div>E-liquids, pods, coils and disposables. Reserve online and pick up in store at San Ildefonso, Bulacan.</div></div>
 <div class="pos"><div>${catalog('shop')}</div><div class="card"><h3>Your cart</h3>${cartLines(S.ccart,'shop')}<div class="tot"><span>Total</span><span>${peso(t)}</span></div>
 <button class="p" style="width:100%" ${S.ccart.length?'':'disabled'} onclick="checkout()">Checkout for pickup</button></div></div>`}
function checkout(){modal(`<h3>Pickup checkout</h3><label>Pickup time</label><select id="slot"><option>Today, 4:00 PM</option><option>Today, 6:00 PM</option><option>Tomorrow, 10:00 AM</option></select>
 <label style="display:block;margin-top:10px">Payment</label><select id="pm" onchange="$('#gc').style.display=this.value==='GCash'?'block':'none'"><option>Pay at store</option><option>GCash</option></select>
 <div id="gc" style="display:none;margin-top:10px"><p style="color:var(--mute)">Send ${peso(sum(S.ccart))} to the store GCash number, then enter the reference number. Staff will verify it.</p><input id="cref" placeholder="GCash reference number"></div>
 <p class="badge warn" style="margin-top:12px">Bring a valid ID showing you are 18 or older. Staff will check it at pickup.</p>
 <div class="row"><button onclick="closeM()">Cancel</button><button class="p" onclick="placeOrder()">Place order</button></div>`)}
function placeOrder(){safe(async()=>{
  const r=await api('order_place',{items:S.ccart.map(x=>({sku:x.sku,qty:x.qty})),pickup_slot:$('#slot').value,payment_method:$('#pm').value,gcash_ref:$('#cref').value.trim()});
  S.ccart=[];closeM();toast('Order '+r.order_no+' placed');go('myorders')})}
const stBadge=s=>`<span class="badge ${s==='Cancelled'?'bad':s==='Completed'?'ok':''}">${esc(s)}</span>`;
function vMy(){return`<h2>My orders</h2>`+(S.my.length?S.my.map(o=>{const i=STEPS.indexOf(o.status);return`<div class="card" style="margin-bottom:12px"><div class="line" style="border:0"><b>${esc(o.order_no)}</b>${stBadge(o.status)}</div>
 <div class="steps">${STEPS.map((s,j)=>`<span class="badge ${o.status!=='Cancelled'&&j<=i?'ok':''}">${s}</span>`).join('')}</div>
 <p style="color:var(--mute)">Pickup: ${esc(o.pickup_slot)} · ${esc(o.payment_method)} · ${peso(o.total)}</p></div>`}).join(''):'<div class="empty">No orders yet. Browse the shop to place one.</div>')}

/* ---------- Cashier: order queue ---------- */
function vOrders(){const act=['Verify payment','Mark ready','Complete pickup'];return`<h2>Online orders</h2><div class="card wrap">${S.orders.length?`<table><tr><th>Order</th><th>Customer</th><th>Pay</th><th>Total</th><th>Status</th><th>Action</th></tr>`+
 S.orders.map(o=>{const i=STEPS.indexOf(o.status),closed=i<0||i===3;return`<tr><td>${esc(o.order_no)}<br><small>${esc(o.pickup_slot)}</small></td><td>${esc(o.customer)}</td><td>${esc(o.payment_method)}${o.gcash_ref?'<br><small>Ref '+esc(o.gcash_ref)+'</small>':''}</td><td>${peso(o.total)}</td><td>${stBadge(o.status)}</td>
 <td>${closed?'—':`<button class="p" data-no="${esc(o.order_no)}" onclick="upd(this.dataset.no,'next')">${act[i]}</button> <button class="d" data-no="${esc(o.order_no)}" onclick="upd(this.dataset.no,'cancel')">Cancel</button>`}</td></tr>`}).join('')+'</table>':'<div class="empty">No online orders yet.</div>'}</div>`}
function upd(no,to){if(to==='cancel'&&!confirm('Cancel '+no+'? Stock will be restored.'))return;
  safe(async()=>{await api('order_update',{order_no:no,to});S.orders=await api('orders');render()})}

/* ---------- Custodian: inventory ---------- */
function vInv(){const ro=S.user.role==='admin',low=S.products.flatMap(p=>p.variants.filter(v=>v.stock<=v.reorder).map(v=>[p,v]));
 return`<div class="row" style="align-items:center;margin-bottom:12px"><h2 style="margin:0">Inventory</h2>${ro?'':'<button class="p" style="flex:0 0 auto" onclick="productForm()">+ Add product</button>'}</div><div class="row" style="align-items:start"><div class="card wrap" style="flex:3;min-width:300px"><table><tr><th>Product</th><th>Category</th><th>Variants</th><th>Stock</th></tr>`+
 S.products.map(p=>`<tr style="cursor:pointer" onclick="S.open[${p.id}]=!S.open[${p.id}];render()"><td><b>${S.open[p.id]?'▾':'▸'} ${esc(p.name)}</b></td><td>${esc(p.cat)}</td><td>${p.variants.length}</td><td>${stockBadge(total(p))}${ro?'':` <button class="d" style="min-height:32px;padding:2px 10px" onclick="event.stopPropagation();delProduct(${p.id})">Delete</button>`}</td></tr>`+
 (S.open[p.id]?p.variants.map(v=>`<tr style="background:var(--bg)"><td style="padding-left:30px">${esc(vlabel(v))}<br><small style="color:var(--mute)">${esc(v.sku)}</small></td><td>${peso(v.price)}</td><td>${stockBadge(v.stock)}</td>
 <td>${ro?'':`<button data-sku="${esc(v.sku)}" onclick="stockForm(this.dataset.sku)">Update stock</button> <button data-sku="${esc(v.sku)}" onclick="priceForm(this.dataset.sku)">Edit price</button>`}</td></tr>`).join(''):'')).join('')+`</table></div>
 <div class="card" style="flex:1"><h3>Low-stock alerts (${low.length})</h3>${low.slice(0,12).map(([p,v])=>`<div class="line"><span>${esc(p.name)}<br><small>${esc(vlabel(v))}</small></span>${stockBadge(v.stock)}</div>`).join('')||'<div class="empty">All variants are stocked.</div>'}</div></div>`}
function stockForm(sku){const[p,v]=find(sku);modal(`<h3>Update stock</h3><p>${esc(p.name)}<br><small>${esc(vlabel(v))} · currently ${v.stock}</small></p>
 <label>Reason</label><select id="why"><option>Delivery</option><option>Damage</option><option>Recount</option><option>Shrinkage</option></select>
 <label style="display:block;margin-top:10px">Quantity</label><input id="sq" type="number" min="1" value="1">
 <p style="color:var(--mute)">Delivery adds stock. Other reasons remove it.</p><div class="row"><button onclick="closeM()">Cancel</button><button class="p" data-sku="${esc(sku)}" onclick="saveStock(this.dataset.sku)">Save</button></div>`)}
function saveStock(sku){safe(async()=>{await api('stock_adjust',{sku,reason:$('#why').value,qty:+$('#sq').value});closeM();await loadProducts();render()})}

/* ---- add product / edit price (custodian) ---- */
const lbl=t=>`<label style="display:block;margin:10px 0 4px;color:var(--mute)">${t}</label>`;
const PH={Flavor:'Mango, Menthol, Grape',Size:'30ml, 60ml',Nicotine:'3mg, 6mg, 24mg',Resistance:'0.6Ω, 0.8Ω'};
const listOf=t=>[...new Set(t.split(',').map(x=>x.trim()).filter(Boolean))];
function productForm(){modal(`<h3>Add product</h3>${lbl('Product name')}<input id="pn" placeholder="e.g. Cloud Nine E-Liquid">
 ${lbl('Category')}<input id="pc" list="cats" placeholder="e.g. E-liquids"><datalist id="cats">${[...new Set(S.products.map(p=>p.cat))].map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
 <div class="row"><div>${lbl('Price (₱)')}<input id="pp" type="number" min="0" step="0.01"></div><div>${lbl('Stock per variant')}<input id="ps" type="number" min="0" value="0"></div><div>${lbl('Reorder level')}<input id="pr" type="number" min="0" value="5"></div></div>
 <p style="color:var(--mute);margin:12px 0 0">Options: separate values with commas. Leave a box empty if it doesn't apply. Every combination becomes its own variant.</p>
 ${Object.keys(PH).map(k=>lbl(k)+`<input class="at" data-k="${k}" placeholder="${PH[k]}" oninput="countV()">`).join('')}
 <p id="vc" class="badge" style="margin-top:12px">Creates 1 variant</p>
 <div class="row"><button onclick="closeM()">Cancel</button><button class="p" onclick="saveProduct()">Save product</button></div>`)}
function countV(){let n=1;document.querySelectorAll('.at').forEach(i=>{const l=listOf(i.value).length;if(l)n*=l});$('#vc').textContent='Creates '+n+' variant'+(n>1?'s':'')}
function saveProduct(){safe(async()=>{
  const attrs={};document.querySelectorAll('.at').forEach(i=>{const l=listOf(i.value);if(l.length)attrs[i.dataset.k]=l});
  const r=await api('product_create',{name:$('#pn').value,category:$('#pc').value,price:+$('#pp').value,stock:+$('#ps').value,reorder:+$('#pr').value,attrs});
  closeM();await loadProducts();render();toast('Product added with '+r.variants+' variant'+(r.variants>1?'s':''))})}
function delProduct(id){const p=S.products.find(x=>x.id===id);
  if(!confirm('Delete "'+p.name+'"?\n\nIf it has sales history, it is hidden instead of erased so past reports stay correct.'))return;
  safe(async()=>{const r=await api('product_delete',{id});await loadProducts();render();toast(r.result==='removed'?'Product deleted':'Product archived (hidden, history kept)')})}
function priceForm(sku){const[p,v]=find(sku);modal(`<h3>Edit price</h3><p>${esc(p.name)}<br><small>${esc(vlabel(v))} · currently ${peso(v.price)}</small></p>
 ${lbl('New price (₱)')}<input id="np" type="number" min="0" step="0.01" value="${v.price}">
 <div class="row"><button onclick="closeM()">Cancel</button><button class="p" data-sku="${esc(sku)}" onclick="savePrice(this.dataset.sku)">Save</button></div>`)}
function savePrice(sku){safe(async()=>{await api('price_set',{sku,price:+$('#np').value});closeM();await loadProducts();render()})}

/* ---------- Admin ---------- */
function vDash(){const d=S.dash,days=d.last_7_days,mx=Math.max(1,...days.map(x=>+x.total));
 return`<h2>Dashboard</h2><div class="row"><div class="card kpi"><span>Today's sales</span><b>${peso(d.sales_today)}</b></div><div class="card kpi"><span>Transactions</span><b>${d.transactions}</b></div>
 <div class="card kpi"><span>Online orders pending</span><b>${d.pending_orders}</b></div><div class="card kpi"><span>Low-stock variants</span><b>${d.low_stock}</b></div></div>
 <div class="row" style="margin-top:12px"><div class="card" style="flex:2"><h3>Sales, last 7 days</h3>${days.length?`<div class="bars" style="margin-bottom:24px">${days.map(x=>`<div style="height:${Math.max(x.total/mx*100,3)}%" title="${peso(x.total)}"><span>${esc(x.day.slice(5))}</span></div>`).join('')}</div>`:'<div class="empty">No sales recorded yet.</div>'}</div>
 <div class="card"><h3>Top variants today</h3>${d.top_variants.map(t=>`<div class="line"><span>${esc(t.sku)}</span><b>${t.sold}</b></div>`).join('')||'<div class="empty">Complete a sale in the POS to see results.</div>'}</div></div>`}
function vAudit(){return`<h2>Audit log</h2><div class="card wrap">${S.audit.length?`<table><tr><th>Time</th><th>Role</th><th>Action</th><th>Details</th><th>IP</th></tr>`+S.audit.map(a=>`<tr><td>${esc(a.created_at)}</td><td>${esc(a.role)}</td><td>${esc(a.action)}</td><td>${esc(a.detail)}</td><td>${esc(a.ip)}</td></tr>`).join('')+'</table>':'<div class="empty">No activity recorded yet.</div>'}</div>`}
const restricted=()=>`<div class="card empty"><h2>Restricted</h2>The ${ROLENAME[S.user.role]} role can't open this page. Log in as a Store Administrator to view it.</div>`;

/* ---------- render ---------- */
function render(keepFocus){
  const u=S.user;$('#app').classList.toggle('anon',!u);$('#out').style.display=u?'':'none';$('#who').textContent=u?u.name+' · '+ROLENAME[u.role]:'';
  if(!u){$('#nav').innerHTML='';$('#main').innerHTML=vAuth();return}
  $('#nav').innerHTML='<small>'+ROLENAME[u.role]+'</small>'+NAV[u.role].map(([id,l,lock])=>`<button class="${S.view===id?'on':''}" onclick="go('${id}')">${lock?'🔒 ':''}${l}</button>`).join('');
  const V={pos:vPos,orders:vOrders,inventory:vInv,dashboard:vDash,audit:vAudit,shop:vShop,myorders:vMy};
  const ok=ACCESS[u.role].includes(S.view),pos=document.activeElement&&document.activeElement.id==='q'?document.activeElement.selectionStart:0;
  $('#main').innerHTML=ok?V[S.view]():restricted();
  if(keepFocus&&$('#q')){$('#q').focus();$('#q').setSelectionRange(pos,pos)}
  if(u.role==='customer'&&!S.ageOk&&!$('#layer').innerHTML)ageGate();
}
function ageGate(){modal(`<h3>Age check</h3><p>You must be 18 or older to enter this site.</p><div class="row"><button onclick="logout();closeM()">Exit</button><button class="p" onclick="S.ageOk=true;closeM()">I am 18 or older</button></div>`)}

/* ---------- start ---------- */
(async()=>{try{const d=await api('me');if(d.user){S.user=d.user;S.ageOk=false;S.view=ACCESS[d.user.role][0];await load()}}catch(e){toast('Cannot reach the server. Open this page through http://localhost/ and check XAMPP is running.')}render()})();
