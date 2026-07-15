import type { Order, ReceivedEvent } from "./order-store";

/**
 * Server-rendered shell for the demo merchant, hydrated by a small vanilla-JS
 * app embedded below. It shares the admin UI's design language (hairline
 * borders, teal accent, status pills, Inter) and adds the things the old page
 * lacked: navigation, search, filters, pagination, an order drawer showing each
 * order's webhook timeline, and live polling that never reloads the page.
 *
 * Deliberately self-contained — no build step, no external assets, no deps. The
 * client polls the same public JSON endpoints (/orders, /events) the tests use.
 */
export function renderDemoPage(orders: Order[], events: ReceivedEvent[]): string {
  // Embedded as JSON so the first paint needs no round-trip. `<` is escaped so
  // the payload can never terminate the script element early.
  const bootstrap = JSON.stringify({ orders, events }).replaceAll("<", "\\u003c");

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Merchant Demo — Fiber MerchantOps</title>
    <style>${CSS}</style>
  </head>
  <body>
    <div class="app">
      <aside class="sidebar">
        <div class="brand">
          <div class="logo">M</div>
          <div>
            <div class="brand-name">Merchant Demo</div>
            <div class="brand-sub">webhook receiver</div>
          </div>
        </div>

        <nav class="nav">
          <p class="nav-heading">General</p>
          <button class="nav-item" data-tab="overview">
            <svg viewBox="0 0 24 24"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>
            Overview
          </button>
          <button class="nav-item" data-tab="orders">
            <svg viewBox="0 0 24 24"><path d="M6 2h12v20l-3-2-3 2-3-2-3 2V2Z"/><path d="M9 7h6M9 11h6"/></svg>
            Orders <span class="nav-count" id="nav-orders">0</span>
          </button>
          <button class="nav-item" data-tab="webhooks">
            <svg viewBox="0 0 24 24"><circle cx="12" cy="6" r="3"/><circle cx="5.5" cy="18" r="3"/><circle cx="18.5" cy="18" r="3"/><path d="M10.5 8.6 7 15M13.5 8.6 17 15M8.5 18h7"/></svg>
            Webhooks <span class="nav-count" id="nav-events">0</span>
          </button>
        </nav>

        <div class="sidebar-foot">
          <div class="live"><span class="dot"></span><span id="live-label">Live</span></div>
        </div>
      </aside>

      <main class="main">
        <header class="page-head">
          <div>
            <h1 id="page-title">Overview</h1>
            <p class="lead" id="page-lead">Signed webhooks received from Fiber MerchantOps.</p>
          </div>
          <div class="head-actions">
            <div class="search" id="search-wrap">
              <svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
              <input id="search" placeholder="Search" autocomplete="off" spellcheck="false" />
            </div>
            <select id="filter" class="select"></select>
          </div>
        </header>

        <section class="tiles" id="tiles"></section>

        <section class="panel" id="panel">
          <div class="panel-head">
            <h2 id="panel-title">Orders</h2>
            <span class="panel-count" id="panel-count"></span>
          </div>
          <div class="scroll">
            <table>
              <thead id="thead"></thead>
              <tbody id="tbody"></tbody>
            </table>
          </div>
          <div class="panel-foot">
            <span class="muted" id="page-info"></span>
            <div class="pager">
              <button class="icon-btn" id="prev" aria-label="Previous page">
                <svg viewBox="0 0 24 24"><path d="m15 18-6-6 6-6"/></svg>
              </button>
              <button class="icon-btn" id="next" aria-label="Next page">
                <svg viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>
              </button>
            </div>
          </div>
        </section>

        <section class="panel" id="recent">
          <div class="panel-head">
            <h2>Recent activity</h2>
            <span class="panel-count">latest 8 webhooks</span>
          </div>
          <div class="scroll">
            <table>
              <thead>
                <tr><th>Event</th><th>Order</th><th>Signature</th><th>Outcome</th><th>Received</th></tr>
              </thead>
              <tbody id="recent-body"></tbody>
            </table>
          </div>
        </section>

        <section class="explain" id="explain">
          <h3>What this server proves</h3>
          <ol>
            <li><strong>Signature verification.</strong> Every request's HMAC is checked against the raw bytes. A wrong secret is rejected with <code>invalid_signature</code> and never touches an order.</li>
            <li><strong>Exactly-once fulfilment.</strong> Delivery is at-least-once, so events repeat. The store dedupes on <code>event_id</code>: a replay is logged as a duplicate and the order is <em>not</em> fulfilled twice.</li>
            <li><strong>Order lifecycle.</strong> <code>payment_intent.paid</code> fulfils, <code>.expired</code> expires, <code>.failed</code> fails. Anything else is acknowledged without changing state.</li>
          </ol>
        </section>
      </main>
    </div>

    <div class="drawer-backdrop" id="backdrop"></div>
    <aside class="drawer" id="drawer" aria-hidden="true">
      <div class="drawer-head">
        <div>
          <h2 id="drawer-title">Order</h2>
          <p class="lead" id="drawer-sub"></p>
        </div>
        <button class="icon-btn" id="drawer-close" aria-label="Close">
          <svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6 6 18"/></svg>
        </button>
      </div>
      <div class="drawer-body" id="drawer-body"></div>
    </aside>

    <script>window.__BOOTSTRAP__ = ${bootstrap};</script>
    <script>${SCRIPT}</script>
  </body>
</html>
`;
}

const CSS = `
:root {
  --canvas:#f1f1ef; --panel:#fff; --hairline:#ebebe9; --hairline-strong:#e0e0dd;
  --rowhover:#fafafa; --ink:#171717; --ink-soft:#525252; --muted:#737373; --faint:#a3a3a3;
  --brand:#0f8b7e; --brand-tint:#e7f4f2;
  --success:#167c4a; --success-bg:#e6f6ec;
  --info:#2563eb;    --info-bg:#e8f0fe;
  --danger:#c2352c;  --danger-bg:#fdecea;
  --warn:#b7791f;    --warn-bg:#fdf6e7;
  --neutral:#525252; --neutral-bg:#f2f2f0;
}
* { box-sizing:border-box; }
html, body { height:100%; }
body {
  margin:0; background:var(--canvas); color:var(--ink);
  font-family:"Inter",ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;
  font-size:14px; line-height:1.5; -webkit-font-smoothing:antialiased;
}
svg { width:17px; height:17px; fill:none; stroke:currentColor; stroke-width:1.6;
      stroke-linecap:round; stroke-linejoin:round; flex:none; }
code { background:var(--neutral-bg); padding:1px 5px; border-radius:4px;
       font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; }

.app { display:flex; height:100vh; overflow:hidden; }

/* Sidebar */
.sidebar { width:250px; flex:none; background:var(--panel);
           border-right:1px solid var(--hairline); display:flex; flex-direction:column; }
.brand { display:flex; align-items:center; gap:10px; padding:16px; }
.logo { width:32px; height:32px; border-radius:9px; background:var(--brand); color:#fff;
        display:grid; place-items:center; font-weight:700; font-size:14px; }
.brand-name { font-size:14px; font-weight:600; letter-spacing:-.01em; }
.brand-sub { font-size:11px; color:var(--faint); }
.nav { padding:8px 12px; flex:1; }
.nav-heading { margin:8px 0 6px; padding:0 8px; font-size:11px; color:var(--faint); }
.nav-item {
  display:flex; align-items:center; gap:10px; width:100%; padding:8px;
  margin-bottom:2px; border:0; border-radius:8px; background:transparent;
  font:inherit; font-size:13px; font-weight:500; color:var(--ink-soft);
  cursor:pointer; text-align:left; transition:background-color .15s,color .15s;
}
.nav-item:hover { background:var(--rowhover); color:var(--ink); }
.nav-item.active { background:var(--brand-tint); color:var(--brand); font-weight:600; }
.nav-count { margin-left:auto; font-size:11px; color:var(--faint);
             background:var(--neutral-bg); padding:1px 6px; border-radius:5px; }
.nav-item.active .nav-count { background:#fff; color:var(--brand); }
.sidebar-foot { padding:12px 16px; border-top:1px solid var(--hairline); }
.live { display:flex; align-items:center; gap:7px; font-size:12px;
        font-weight:600; color:var(--ink); margin-bottom:4px; }
.dot { width:7px; height:7px; border-radius:50%; background:var(--success);
       box-shadow:0 0 0 3px var(--success-bg); animation:pulse 2s ease-in-out infinite; }
@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.35} }

/* Main */
.main { flex:1; overflow-y:auto; padding:20px; }
.page-head { display:flex; align-items:flex-start; justify-content:space-between;
             gap:16px; flex-wrap:wrap; margin-bottom:16px; }
h1 { margin:0; font-size:19px; font-weight:600; letter-spacing:-.02em; }
.lead { margin:2px 0 0; font-size:13px; color:var(--muted); }
.head-actions { display:flex; gap:8px; }
.search { position:relative; }
.search svg { position:absolute; left:9px; top:50%; transform:translateY(-50%);
              width:15px; height:15px; color:var(--faint); pointer-events:none; }
.search input, .select {
  height:36px; border:1px solid var(--hairline-strong); border-radius:8px;
  background:var(--panel); font:inherit; font-size:13px; color:var(--ink);
  transition:border-color .15s;
}
.search input { width:240px; padding:0 12px 0 30px; }
.search input::placeholder { color:var(--faint); }
.select { padding:0 30px 0 10px; cursor:pointer; appearance:none;
  background-image:url("data:image/svg+xml;charset=utf-8,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23a3a3a3' stroke-width='1.6' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");
  background-repeat:no-repeat; background-position:right 8px center; background-size:15px;
}
.search input:hover, .select:hover { border-color:var(--faint); }
.search input:focus, .select:focus { outline:none; border-color:var(--brand); }

/* Tiles */
.tiles { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
         gap:12px; margin-bottom:16px; }
.tile { background:var(--panel); border:1px solid var(--hairline);
        border-radius:12px; padding:14px 16px; }
.tile .label { font-size:12px; color:var(--muted); display:flex; align-items:center; gap:6px; }
.tile .value { font-size:22px; font-weight:700; letter-spacing:-.02em;
               font-variant-numeric:tabular-nums; margin-top:2px; }
.tile .value.ok { color:var(--success); }
.tile .value.bad { color:var(--danger); }
.tile .value.warn { color:var(--warn); }

/* Panel + table */
.panel { background:var(--panel); border:1px solid var(--hairline);
         border-radius:12px; overflow:hidden; margin-bottom:16px; }
.panel-head { display:flex; align-items:center; gap:8px; padding:13px 18px;
              border-bottom:1px solid var(--hairline); }
.panel-head h2 { margin:0; font-size:14px; font-weight:600; }
.panel-count { font-size:12px; color:var(--muted); }
.scroll { overflow-x:auto; }
table { width:100%; border-collapse:collapse; }
th { text-align:left; padding:10px 18px; font-size:12px; font-weight:500;
     color:var(--ink-soft); border-bottom:1px solid var(--hairline); white-space:nowrap; }
td { padding:11px 18px; font-size:13px; border-bottom:1px solid var(--hairline); }
tbody tr:last-child td { border-bottom:0; }
tbody tr.clickable { cursor:pointer; transition:background-color .15s; }
tbody tr.clickable:hover { background:var(--rowhover); }
.stack { display:flex; flex-direction:column; min-width:0; }
.strong { font-weight:500; }
.sub { font-size:12px; color:var(--muted); }
.mono { font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace; font-size:11px; }
.muted { color:var(--muted); }
.faint { color:var(--faint); }
.nowrap { white-space:nowrap; }
.num { font-weight:600; font-variant-numeric:tabular-nums; white-space:nowrap; }
.empty { text-align:center; color:var(--muted); padding:48px 18px; }
.panel-foot { display:flex; align-items:center; justify-content:space-between;
              gap:12px; padding:10px 18px; border-top:1px solid var(--hairline); font-size:13px; }
.pager { display:flex; gap:6px; }
.icon-btn { display:grid; place-items:center; width:32px; height:32px;
            border:1px solid var(--hairline-strong); border-radius:8px;
            background:var(--panel); color:var(--ink-soft); cursor:pointer;
            transition:background-color .15s,color .15s; }
.icon-btn:hover:not(:disabled) { background:var(--rowhover); color:var(--ink); }
.icon-btn:disabled { opacity:.4; cursor:not-allowed; }

/* Pills */
.pill { display:inline-flex; align-items:center; white-space:nowrap; padding:3px 8px;
        border-radius:6px; font-size:12px; font-weight:500; line-height:1; }
.pill-success{background:var(--success-bg);color:var(--success)}
.pill-info{background:var(--info-bg);color:var(--info)}
.pill-danger{background:var(--danger-bg);color:var(--danger)}
.pill-warn{background:var(--warn-bg);color:var(--warn)}
.pill-neutral{background:var(--neutral-bg);color:var(--neutral)}

/* Explain */
.explain { background:var(--panel); border:1px solid var(--hairline);
           border-radius:12px; padding:18px; }
.explain h3 { margin:0 0 10px; font-size:14px; font-weight:600; }
.explain ol { margin:0; padding-left:18px; color:var(--muted); font-size:13px; }
.explain li { margin-bottom:8px; }
.explain li:last-child { margin-bottom:0; }
.explain strong { color:var(--ink); font-weight:600; }

/* Drawer */
.drawer-backdrop { position:fixed; inset:0; background:rgba(23,23,23,.35);
                   opacity:0; pointer-events:none; transition:opacity .2s; z-index:20; }
.drawer-backdrop.open { opacity:1; pointer-events:auto; }
.drawer { position:fixed; top:0; right:0; bottom:0; width:min(460px,100%);
          background:var(--panel); border-left:1px solid var(--hairline);
          transform:translateX(100%); transition:transform .22s ease;
          z-index:21; display:flex; flex-direction:column; }
.drawer.open { transform:translateX(0); }
.drawer-head { display:flex; align-items:flex-start; justify-content:space-between;
               gap:12px; padding:16px 18px; border-bottom:1px solid var(--hairline); }
.drawer-head h2 { margin:0; font-size:16px; font-weight:600; }
.drawer-body { padding:18px; overflow-y:auto; flex:1; }
.kv { display:flex; justify-content:space-between; gap:12px; padding:8px 0;
      border-bottom:1px solid var(--hairline); font-size:13px; }
.kv:last-child { border-bottom:0; }
.kv dt { color:var(--muted); }
.kv dd { margin:0; text-align:right; word-break:break-all; }
.drawer-body h3 { margin:20px 0 10px; font-size:13px; font-weight:600; }

/* Timeline — the order's webhook history, newest last */
.timeline { position:relative; padding-left:20px; }
.timeline::before { content:""; position:absolute; left:5px; top:4px; bottom:4px;
                    width:2px; background:var(--hairline); }
.tl-item { position:relative; padding-bottom:14px; }
.tl-item:last-child { padding-bottom:0; }
.tl-dot { position:absolute; left:-19px; top:3px; width:12px; height:12px;
          border-radius:50%; border:2px solid var(--panel); }
.tl-dot.success{background:var(--success)} .tl-dot.danger{background:var(--danger)}
.tl-dot.warn{background:var(--warn)} .tl-dot.neutral{background:var(--faint)}
.tl-title { font-size:13px; font-weight:500; }
.tl-meta { font-size:12px; color:var(--muted); margin-top:2px; }
.tl-tags { display:flex; gap:6px; margin-top:6px; flex-wrap:wrap; }

@media (max-width:820px) {
  .sidebar { display:none; }
  .search input { width:150px; }
}
`;

const SCRIPT = `
(function () {
  var S = {
    orders: window.__BOOTSTRAP__.orders || [],
    events: window.__BOOTSTRAP__.events || [],
    tab: "overview",
    q: "",
    filter: "",
    page: 1,
    size: 12,
    selected: null,
  };

  var ORDER_TONE = { pending:"info", fulfilled:"success", expired:"warn", failed:"danger" };
  var OUTCOME_TONE = {
    fulfilled:"success", expired:"warn", failed:"danger", acknowledged:"neutral",
    duplicate_ignored:"warn", invalid_signature:"danger", malformed:"danger"
  };

  var FILTERS = {
    orders: [["","All status"],["pending","Pending"],["fulfilled","Fulfilled"],["expired","Expired"],["failed","Failed"]],
    webhooks: [["","All events"],["verified","Verified only"],["rejected","Signature rejected"],["duplicate","Duplicates only"],["fulfilled","Fulfilled"]],
    overview: []
  };

  var $ = function (id) { return document.getElementById(id); };

  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c];
    });
  }
  function dash(v) { return (v == null || v === "") ? '<span class="faint">—</span>' : esc(v); }
  function pill(text, tone) {
    return '<span class="pill pill-' + tone + '">' + esc(String(text).replace(/_/g, " ")) + "</span>";
  }
  function time(iso) {
    var d = new Date(iso);
    if (isNaN(d.getTime())) return esc(iso);
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(d.getDate()) + "/" + p(d.getMonth() + 1) + "/" + d.getFullYear() +
      ", " + p(d.getHours()) + ":" + p(d.getMinutes()) + ":" + p(d.getSeconds());
  }

  /** Every webhook this demo received for one order, oldest first. */
  function eventsFor(orderId) {
    return S.events.filter(function (e) { return e.order_id === orderId; });
  }

  function matchesQuery(hay) {
    if (!S.q) return true;
    return hay.join(" ").toLowerCase().indexOf(S.q.toLowerCase()) !== -1;
  }

  function visibleRows() {
    if (S.tab === "orders") {
      return S.orders.filter(function (o) {
        if (S.filter && o.status !== S.filter) return false;
        return matchesQuery([o.order_id, o.payment_intent_id, o.status, o.asset]);
      }).slice().reverse();
    }
    if (S.tab === "webhooks") {
      return S.events.filter(function (e) {
        if (S.filter === "verified" && !e.verified) return false;
        if (S.filter === "rejected" && e.verified) return false;
        if (S.filter === "duplicate" && !e.duplicate) return false;
        if (S.filter === "fulfilled" && e.outcome !== "fulfilled") return false;
        return matchesQuery([e.type, e.event_id, e.order_id, e.outcome]);
      }).slice().reverse();
    }
    return [];
  }

  function renderTiles() {
    var fulfilled = S.orders.filter(function (o) { return o.status === "fulfilled"; }).length;
    var dupes = S.events.filter(function (e) { return e.duplicate; }).length;
    var rejects = S.events.filter(function (e) { return !e.verified; }).length;
    var pending = S.orders.filter(function (o) { return o.status === "pending"; }).length;

    $("tiles").innerHTML = [
      tile("Orders", S.orders.length, ""),
      tile("Fulfilled", fulfilled, "ok"),
      tile("Awaiting payment", pending, ""),
      tile("Webhooks received", S.events.length, ""),
      tile("Duplicates ignored", dupes, dupes ? "warn" : ""),
      tile("Signature rejects", rejects, rejects ? "bad" : "")
    ].join("");

    $("nav-orders").textContent = S.orders.length;
    $("nav-events").textContent = S.events.length;
  }
  function tile(label, value, tone) {
    return '<div class="tile"><div class="label">' + esc(label) + '</div>' +
      '<div class="value ' + tone + '">' + value + "</div></div>";
  }

  function renderTable() {
    var rows = visibleRows();
    var pages = Math.max(1, Math.ceil(rows.length / S.size));
    if (S.page > pages) S.page = pages;
    var slice = rows.slice((S.page - 1) * S.size, S.page * S.size);

    var head, body;
    if (S.tab === "orders") {
      head = "<tr><th>Order</th><th>Status</th><th>Amount</th><th>Webhooks</th><th>Updated</th></tr>";
      body = slice.map(function (o) {
        var n = eventsFor(o.order_id).length;
        return '<tr class="clickable" data-order="' + esc(o.order_id) + '">' +
          '<td><div class="stack"><span class="strong">' + esc(o.order_id) + "</span>" +
          '<span class="sub mono">' + dash(o.payment_intent_id) + "</span></div></td>" +
          "<td>" + pill(o.status, ORDER_TONE[o.status] || "neutral") + "</td>" +
          '<td class="num">' + (o.amount
            ? esc(o.amount) + ' <span class="sub">' + esc(o.asset) + "</span>"
            : '<span class="faint">—</span>') + "</td>" +
          '<td class="muted">' + n + "</td>" +
          '<td class="muted nowrap">' + time(o.updated_at) + "</td></tr>";
      }).join("");
    } else {
      head = "<tr><th>Event</th><th>Order</th><th>Signature</th><th>Replay</th><th>Outcome</th><th>Received</th></tr>";
      body = slice.map(function (e) {
        return '<tr class="clickable" data-order="' + esc(e.order_id || "") + '">' +
          '<td><div class="stack"><span class="strong">' + dash(e.type) + "</span>" +
          '<span class="sub mono">' + dash(e.event_id) + "</span></div></td>" +
          "<td>" + dash(e.order_id) + "</td>" +
          "<td>" + (e.verified ? pill("verified", "success") : pill("invalid signature", "danger")) + "</td>" +
          "<td>" + (e.duplicate ? pill("duplicate", "warn") : '<span class="faint">—</span>') + "</td>" +
          "<td>" + pill(e.outcome, OUTCOME_TONE[e.outcome] || "neutral") + "</td>" +
          '<td class="muted nowrap">' + time(e.received_at) + "</td></tr>";
      }).join("");
    }

    $("thead").innerHTML = head;
    $("tbody").innerHTML = body || '<tr><td class="empty" colspan="6">' +
      (S.q || S.filter ? "Nothing matches that filter." :
        S.tab === "orders" ? "No orders yet." : "No webhooks received yet.") + "</td></tr>";

    $("panel-title").textContent = S.tab === "orders" ? "Orders" : "Received webhooks";
    $("panel-count").textContent = rows.length + (S.tab === "orders" ? " orders" : " events");
    $("page-info").textContent = "Page " + S.page + " of " + pages;
    $("prev").disabled = S.page <= 1;
    $("next").disabled = S.page >= pages;
  }

  function renderRecent() {
    var latest = S.events.slice(-8).reverse();
    $("recent-body").innerHTML = latest.length
      ? latest.map(function (e) {
          return '<tr class="clickable" data-order="' + esc(e.order_id || "") + '">' +
            '<td><div class="stack"><span class="strong">' + dash(e.type) + "</span>" +
            '<span class="sub mono">' + dash(e.event_id) + "</span></div></td>" +
            "<td>" + dash(e.order_id) + "</td>" +
            "<td>" + (e.verified ? pill("verified", "success") : pill("invalid signature", "danger")) + "</td>" +
            "<td>" + pill(e.outcome, OUTCOME_TONE[e.outcome] || "neutral") + "</td>" +
            '<td class="muted nowrap">' + time(e.received_at) + "</td></tr>";
        }).join("")
      : '<tr><td class="empty" colspan="5">No webhooks received yet.</td></tr>';
  }

  function render() {
    document.querySelectorAll(".nav-item").forEach(function (b) {
      b.classList.toggle("active", b.dataset.tab === S.tab);
    });

    var overview = S.tab === "overview";
    $("panel").style.display = overview ? "none" : "";
    $("recent").style.display = overview ? "" : "none";
    $("explain").style.display = overview ? "" : "none";
    $("search-wrap").style.display = overview ? "none" : "";
    $("filter").style.display = overview ? "none" : "";

    $("page-title").textContent =
      overview ? "Overview" : S.tab === "orders" ? "Orders" : "Webhooks";
    $("page-lead").textContent = overview
      ? "This server receives signed webhooks, verifies each HMAC, and fulfils every order exactly once."
      : S.tab === "orders"
        ? "Click an order to see every webhook it received."
        : "Every webhook received, newest first — including replays and rejected signatures.";

    if (!overview) {
      var opts = FILTERS[S.tab];
      var current = $("filter").value;
      $("filter").innerHTML = opts.map(function (o) {
        return '<option value="' + o[0] + '">' + o[1] + "</option>";
      }).join("");
      $("filter").value = opts.some(function (o) { return o[0] === current; }) ? current : "";
    }

    renderTiles();
    if (overview) renderRecent();
    else renderTable();
  }

  /* Hash routing: #orders, #webhooks, #order=<id>. Gives the demo shareable
     links and working back/forward navigation. */
  function applyHash() {
    var h = location.hash.replace(/^#/, "");
    if (h.indexOf("order=") === 0) {
      var id = decodeURIComponent(h.slice(6));
      if (S.tab === "overview") S.tab = "orders";
      render();
      openDrawer(id, true);
      return;
    }
    closeDrawer(true);
    S.tab = h === "orders" || h === "webhooks" ? h : "overview";
    S.page = 1;
    render();
  }

  function setHash(value) {
    if (location.hash.replace(/^#/, "") === value) return;
    history.pushState(null, "", value ? "#" + value : location.pathname);
  }

  function openDrawer(orderId, fromHash) {
    if (!orderId) return;
    var order = S.orders.find(function (o) { return o.order_id === orderId; });
    var evs = eventsFor(orderId);
    if (!order && !evs.length) return;

    S.selected = orderId;
    if (!fromHash) setHash("order=" + encodeURIComponent(orderId));
    $("drawer-title").textContent = orderId;
    $("drawer-sub").textContent = evs.length + " webhook" + (evs.length === 1 ? "" : "s") + " received";

    var kv = "";
    if (order) {
      kv = '<dl style="margin:0">' +
        '<div class="kv"><dt>Status</dt><dd>' + pill(order.status, ORDER_TONE[order.status] || "neutral") + "</dd></div>" +
        '<div class="kv"><dt>Amount</dt><dd class="num">' +
          (order.amount ? esc(order.amount) + " " + esc(order.asset) : "—") + "</dd></div>" +
        '<div class="kv"><dt>Payment intent</dt><dd class="mono">' + dash(order.payment_intent_id) + "</dd></div>" +
        '<div class="kv"><dt>Created</dt><dd>' + time(order.created_at) + "</dd></div>" +
        '<div class="kv"><dt>Updated</dt><dd>' + time(order.updated_at) + "</dd></div></dl>";
    }

    var fulfilments = evs.filter(function (e) { return e.outcome === "fulfilled"; }).length;
    var dupes = evs.filter(function (e) { return e.duplicate; }).length;
    var note = "";
    if (dupes > 0) {
      note = '<div style="margin-top:14px;padding:10px 12px;border-radius:8px;' +
        'background:var(--success-bg);color:var(--success);font-size:12px">' +
        "<strong>Exactly once.</strong> " + dupes + " duplicate" + (dupes === 1 ? "" : "s") +
        " ignored — this order was fulfilled " + fulfilments + " time" +
        (fulfilments === 1 ? "" : "s") + ", not " + (fulfilments + dupes) + ".</div>";
    }

    var timeline = evs.length
      ? '<div class="timeline">' + evs.map(function (e) {
          var tone = e.verified ? (OUTCOME_TONE[e.outcome] || "neutral") : "danger";
          var tags = [];
          tags.push(e.verified ? pill("verified", "success") : pill("invalid signature", "danger"));
          if (e.duplicate) tags.push(pill("duplicate", "warn"));
          tags.push(pill(e.outcome, OUTCOME_TONE[e.outcome] || "neutral"));
          return '<div class="tl-item"><span class="tl-dot ' + tone + '"></span>' +
            '<div class="tl-title">' + dash(e.type) + "</div>" +
            '<div class="tl-meta mono">' + dash(e.event_id) + "</div>" +
            '<div class="tl-meta">' + time(e.received_at) + "</div>" +
            '<div class="tl-tags">' + tags.join("") + "</div></div>";
        }).join("") + "</div>"
      : '<p class="muted">No webhooks for this order yet.</p>';

    $("drawer-body").innerHTML = kv + note + "<h3>Webhook timeline</h3>" + timeline;
    $("drawer").classList.add("open");
    $("drawer").setAttribute("aria-hidden", "false");
    $("backdrop").classList.add("open");
  }

  function closeDrawer(fromHash) {
    if (S.selected && !fromHash) setHash(S.tab === "overview" ? "" : S.tab);
    S.selected = null;
    $("drawer").classList.remove("open");
    $("drawer").setAttribute("aria-hidden", "true");
    $("backdrop").classList.remove("open");
  }

  /* Live polling — updates in place, never reloads, keeps scroll and focus. */
  function poll() {
    Promise.all([
      fetch("/orders").then(function (r) { return r.json(); }),
      fetch("/events").then(function (r) { return r.json(); })
    ]).then(function (res) {
      var changed =
        res[0].orders.length !== S.orders.length ||
        res[1].events.length !== S.events.length;
      S.orders = res[0].orders;
      S.events = res[1].events;
      $("live-label").textContent = "Live";
      render();
      if (changed && S.selected) openDrawer(S.selected);
    }).catch(function () {
      $("live-label").textContent = "Reconnecting…";
    });
  }

  document.querySelectorAll(".nav-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      S.tab = btn.dataset.tab;
      S.page = 1;
      S.q = "";
      S.filter = "";
      $("search").value = "";
      closeDrawer(true);
      setHash(S.tab === "overview" ? "" : S.tab);
      render();
    });
  });

  $("search").addEventListener("input", function (e) {
    S.q = e.target.value; S.page = 1; renderTable();
  });
  $("filter").addEventListener("change", function (e) {
    S.filter = e.target.value; S.page = 1; renderTable();
  });
  $("prev").addEventListener("click", function () { S.page--; renderTable(); });
  $("next").addEventListener("click", function () { S.page++; renderTable(); });

  ["tbody", "recent-body"].forEach(function (id) {
    $(id).addEventListener("click", function (e) {
      var row = e.target.closest("tr[data-order]");
      if (row) openDrawer(row.dataset.order);
    });
  });

  $("drawer-close").addEventListener("click", function () { closeDrawer(); });
  $("backdrop").addEventListener("click", function () { closeDrawer(); });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeDrawer();
  });
  window.addEventListener("popstate", applyHash);
  window.addEventListener("hashchange", applyHash);

  applyHash();
  setInterval(poll, 3000);
})();
`;
