/* ----------


ADMIN



---------- */

/* Tagged template that removes leading/trailing whitespace on each
   line and joins lines with no separator, so multi-line HTML strings
   in source produce the same output as it would in a one line */

function html(strings, ...values) {
  const raw = strings.reduce(
    (out, s, i) => out + s.replace(/\s*\n\s*/g, '') + (i < values.length ? values[i] : ''),
    ''
  );
  return raw;
}

function vDash() {
  const d = S.dash;
  const days = d.last_7_days;
  const mx = Math.max(1, ...days.map(x => +x.total));

  const kpis = html`
    <div class="row">
      <div class="card kpi"><span>Today's sales</span><b>${peso(d.sales_today)}</b></div>
      <div class="card kpi"><span>Transactions</span><b>${d.transactions}</b></div>
      <div class="card kpi"><span>Online orders pending</span><b>${d.pending_orders}</b></div>
      <div class="card kpi"><span>Low-stock variants</span><b>${d.low_stock}</b></div>
    </div>
  `;

  const salesChart = days.length
    ? html`
        <div class="bars" style="margin-bottom:24px">
          ${days.map(x => html`
            <div style="height:${Math.max(x.total / mx * 100, 3)}%" title="${peso(x.total)}">
              <span>${esc(x.day.slice(5))}</span>
            </div>
          `).join('')}
        </div>
      `
    : '<div class="empty">No sales recorded yet.</div>';

  const topVariants = d.top_variants
    .map(t => html`
      <div class="line">
        <span>${esc(t.sku)}</span><b>${t.sold}</b>
      </div>
    `)
    .join('') || '<div class="empty">Complete a sale in the POS to see results.</div>';

  return html`
    <h2>Dashboard</h2>
    <div class="row">${kpis}</div>
    <div class="row" style="margin-top:12px">
      <div class="card" style="flex:2">
        <h3>Sales, last 7 days</h3>
        ${salesChart}
      </div>
      <div class="card">
        <h3>Top variants today</h3>
        ${topVariants}
      </div>
    </div>
  `;
}

function vAudit() {
  const rows = S.audit
    .map(a => html`
      <tr>
        <td>${esc(a.created_at)}</td>
        <td>${esc(a.role)}</td>
        <td>${esc(a.action)}</td>
        <td>${esc(a.detail)}</td>
        <td>${esc(a.ip)}</td>
      </tr>
    `)
    .join('');

  const table = S.audit.length
    ? html`
        <table>
          <tr><th>Time</th><th>Role</th><th>Action</th><th>Details</th><th>IP</th></tr>
          ${rows}
        </table>
      `
    : '<div class="empty">No activity recorded yet.</div>';

  return html`
    <h2>Audit log</h2>
    <div class="card wrap">${table}</div>
  `;
}

const restricted = () => html`
  <div class="card empty">
    <h2>Restricted</h2>
    The ${ROLENAME[S.user.role]} role can't open this page. Log in as a Store Administrator to view it.
  </div>
`;