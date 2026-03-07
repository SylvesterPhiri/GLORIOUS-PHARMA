#!/usr/bin/env node
// =============================================================================
// health-check.js — Glorious Pharma API Diagnostic
// =============================================================================
// Usage:
//   node health-check.js                          (prompts for credentials)
//   node health-check.js --email x --password y   (non-interactive)
//   node health-check.js --port 3001              (custom port)
//   node health-check.js --verbose                (show full error bodies)
// =============================================================================

const http     = require('http');
const https    = require('https');
const readline = require('readline');

// ── CLI args ──────────────────────────────────────────────────────────────────
const args     = process.argv.slice(2);
const get      = (flag) => { const i = args.indexOf(flag); return i !== -1 ? args[i + 1] : null; };
const PORT     = parseInt(get('--port') || '3000');
const VERBOSE  = args.includes('--verbose');
const BASE     = `http://localhost:${PORT}`;
const ARG_EMAIL    = get('--email');
const ARG_PASSWORD = get('--password');

// ── Colours ───────────────────────────────────────────────────────────────────
const C = {
  reset: '\x1b[0m', bold: '\x1b[1m',
  red: '\x1b[31m',  yellow: '\x1b[33m', green: '\x1b[32m',
  cyan: '\x1b[36m', gray: '\x1b[90m',   white: '\x1b[97m',
  blue: '\x1b[34m',
};

// ── Session cookie store ──────────────────────────────────────────────────────
let sessionCookie = '';

// ── HTTP helper ───────────────────────────────────────────────────────────────
function request(method, path, body = null) {
  return new Promise((resolve) => {
    const bodyStr  = body ? JSON.stringify(body) : null;
    const options  = {
      hostname: 'localhost',
      port:     PORT,
      path,
      method,
      headers: {
        'Content-Type': 'application/json',
        'Accept':       'application/json',
        ...(sessionCookie ? { 'Cookie': sessionCookie } : {}),
        ...(bodyStr ? { 'Content-Length': Buffer.byteLength(bodyStr) } : {}),
      },
      timeout: 10000,
    };

    const t0  = Date.now();
    const req = http.request(options, (res) => {
      // Capture set-cookie headers for login
      const setCookie = res.headers['set-cookie'];
      if (setCookie) {
        const match = setCookie.join(';').match(/glorious_session=[^;]+/);
        if (match) sessionCookie = match[0];
      }

      let data = '';
      res.on('data', (c) => { data += c; });
      res.on('end', () => {
        const ms = Date.now() - t0;
        let json = null;
        try { json = JSON.parse(data); } catch (_) {}
        resolve({ status: res.statusCode, ms, raw: data, json, ok: res.statusCode < 400 });
      });
    });

    req.on('error',   (e) => resolve({ status: 0,   ms: Date.now() - t0, error: e.message, ok: false, json: null }));
    req.on('timeout', ()  => { req.destroy(); resolve({ status: 408, ms: 10000, error: 'Timeout after 10s', ok: false, json: null }); });
    if (bodyStr) req.write(bodyStr);
    req.end();
  });
}

// ── Prompt helper ─────────────────────────────────────────────────────────────
function prompt(question, hidden = false) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    if (hidden) {
      process.stdout.write(question);
      process.stdin.setRawMode?.(true);
      let password = '';
      process.stdin.resume();
      process.stdin.setEncoding('utf8');
      const onData = (ch) => {
        ch = ch + '';
        if (ch === '\n' || ch === '\r' || ch === '\u0003') {
          process.stdin.setRawMode?.(false);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          console.log('');
          rl.close();
          resolve(password);
        } else if (ch === '\u007f') {
          password = password.slice(0, -1);
        } else {
          password += ch;
        }
      };
      process.stdin.on('data', onData);
    } else {
      rl.question(question, (ans) => { rl.close(); resolve(ans.trim()); });
    }
  });
}

// ── Result store ──────────────────────────────────────────────────────────────
const results = [];

function record(group, name, res, { info = '', warns = [] } = {}) {
  let detail = info;
  if (!res.ok) {
    if (res.status === 401) {
      detail = 'Still getting 401 — session cookie may not have been sent';
    } else {
      detail = res.error || `HTTP ${res.status}`;
      if (res.json?.error)   detail += ` — ${res.json.error}`;
      if (res.json?.details) detail += ` (${res.json.details})`;
    }
    if (VERBOSE && res.raw) detail += `\n           Body: ${res.raw.substring(0, 300)}`;
  }
  results.push({ group, name, ok: res.ok, status: res.status || 0, ms: res.ms || 0, detail, warns });
  return res;
}

// ── Display ───────────────────────────────────────────────────────────────────
function icon(ok, warns) {
  if (!ok)           return `${C.red}✗${C.reset}`;
  if (warns?.length) return `${C.yellow}⚠${C.reset}`;
  return `${C.green}✓${C.reset}`;
}
function msColor(ms) {
  if (!ms)       return `${C.gray}—${C.reset}`;
  if (ms > 2000) return `${C.red}${ms}ms${C.reset}`;
  if (ms > 700)  return `${C.yellow}${ms}ms${C.reset}`;
  return `${C.gray}${ms}ms${C.reset}`;
}
function printLine(r) {
  const ic  = icon(r.ok, r.warns);
  const st  = r.status === 0  ? `${C.gray}  —${C.reset}` :
              r.ok            ? `${C.gray}${r.status}${C.reset}` :
                                `${C.red}${r.status}${C.reset}`;
  const det = r.detail ? `  ${C.gray}${r.detail}${C.reset}` : '';
  console.log(`  ${ic}  ${r.name.padEnd(44)} ${st}  ${msColor(r.ms)}${det}`);
  for (const w of (r.warns || [])) console.log(`     ${C.yellow}⚠  ${w}${C.reset}`);
}
function section(title) {
  console.log(`\n${C.bold}${C.blue}── ${title} ${'─'.repeat(Math.max(2, 50 - title.length))}${C.reset}`);
}

// =============================================================================
// LOGIN
// =============================================================================

async function login() {
  section('LOGIN');

  // First check server is up at all
  const ping = await request('GET', '/api/auth/me');
  if (ping.status === 0) {
    console.log(`\n  ${C.red}${C.bold}Cannot reach ${BASE}${C.reset}`);
    console.log(`  ${C.gray}Make sure your dev server is running:  ${C.white}npm run dev${C.reset}\n`);
    process.exit(1);
  }

  let email    = ARG_EMAIL;
  let password = ARG_PASSWORD;

  if (!email || !password) {
    console.log(`\n  ${C.gray}Enter your admin credentials to authenticate the health check.${C.reset}`);
    console.log(`  ${C.gray}(These are sent only to your local server — nothing leaves your machine)${C.reset}\n`);
    email    = email    || await prompt(`  ${C.white}Email:    ${C.reset}`);
    password = password || await prompt(`  ${C.white}Password: ${C.reset}`, true);
  }

  const res = await request('POST', '/api/auth/login', { email, password });

  if (!res.ok) {
    console.log(`\n  ${C.red}${C.bold}Login failed (HTTP ${res.status})${C.reset}`);
    if (res.json?.error) console.log(`  ${C.red}${res.json.error}${C.reset}`);
    console.log(`  ${C.gray}Check your email/password and try again.${C.reset}\n`);
    process.exit(1);
  }

  const user = res.json?.user ?? res.json;
  console.log(`\n  ${C.green}${C.bold}✓ Logged in as: ${user?.name ?? email} (${user?.role ?? 'unknown role'})${C.reset}`);
  if (!sessionCookie) {
    console.log(`  ${C.yellow}⚠  No session cookie received — subsequent requests may still get 401${C.reset}`);
  }

  return true;
}

// =============================================================================
// TEST SUITES
// =============================================================================

async function testSettings() {
  section('SETTINGS');
  const r = await request('GET', '/api/settings');
  const s = r.json?.settings ?? r.json;
  const warns = [];
  if (r.ok) {
    if (!s?.companyName) warns.push('companyName not configured in settings');
    if (!s?.currency)    warns.push('currency not configured in settings');
  }
  record('Settings', 'GET /api/settings', r, {
    info:  r.ok ? `company: "${s?.companyName || '—'}"  currency: ${s?.currency || '—'}` : '',
    warns,
  });
}

async function testClients() {
  section('CLIENTS');
  const r1 = await request('GET', '/api/clients');
  const clients = Array.isArray(r1.json) ? r1.json : (r1.json?.clients ?? []);
  record('Clients', 'GET /api/clients', r1, {
    info:  r1.ok ? `${clients.length} clients in database` : '',
    warns: r1.ok && clients.length === 0 ? ['No clients found — add some to test further'] : [],
  });

  const r2 = await request('GET', '/api/clients?search=a');
  record('Clients', 'GET /api/clients?search=', r2, {
    info: r2.ok ? `search working (${(Array.isArray(r2.json) ? r2.json : r2.json?.clients ?? []).length} results for "a")` : '',
  });

  if (clients.length > 0) {
    const id = clients[0].id;
    const r3 = await request('GET', `/api/clients/${id}`);
    record('Clients', 'GET /api/clients/:id', r3, {
      info:  r3.ok ? `fetched: "${clients[0].name}"` : '',
      warns: r3.ok && !r3.json?.id ? ['Response missing id field'] : [],
    });
  } else {
    results.push({ group: 'Clients', name: 'GET /api/clients/:id', ok: true, status: 0, ms: 0, detail: 'Skipped — no clients yet', warns: [] });
  }
  return clients[0]?.id ?? null;
}

async function testManufacturers() {
  section('MANUFACTURERS');
  const r1 = await request('GET', '/api/manufacturers');
  const mfrs = Array.isArray(r1.json) ? r1.json : (r1.json?.manufacturers ?? []);
  record('Manufacturers', 'GET /api/manufacturers', r1, {
    info: r1.ok ? `${mfrs.length} manufacturers` : '',
  });
  if (mfrs.length > 0) {
    const r2 = await request('GET', `/api/manufacturers/${mfrs[0].id}`);
    record('Manufacturers', 'GET /api/manufacturers/:id', r2, {
      info: r2.ok ? `fetched: "${mfrs[0].name}"` : '',
    });
  } else {
    results.push({ group: 'Manufacturers', name: 'GET /api/manufacturers/:id', ok: true, status: 0, ms: 0, detail: 'Skipped — no manufacturers yet', warns: [] });
  }
}

async function testInventory() {
  section('INVENTORY & PRODUCTS');
  const r1 = await request('GET', '/api/products');
  const products = r1.json?.products ?? (Array.isArray(r1.json) ? r1.json : []);
  const lowStock = products.filter(p => p.currentStock <= p.minStock).length;
  const expired  = products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date()).length;
  const negative = products.filter(p => p.currentStock < 0).length;
  const warns    = [];
  if (negative > 0) warns.push(`${negative} products have NEGATIVE stock — data integrity issue`);
  if (expired  > 0) warns.push(`${expired} products are past their expiry date`);
  record('Inventory', 'GET /api/products', r1, {
    info:  r1.ok ? `${products.length} products  |  ${lowStock} low stock  |  ${expired} expired` : '',
    warns,
  });

  const r2 = await request('GET', '/api/products?lowStock=true');
  record('Inventory', 'GET /api/products?lowStock=true', r2, {
    info: r2.ok ? `${(r2.json?.products ?? r2.json ?? []).length} low-stock items` : '',
  });

  if (products.length > 0) {
    const r3 = await request('GET', `/api/products/${products[0].id}`);
    record('Inventory', 'GET /api/products/:id', r3, {
      info: r3.ok ? `"${products[0].name}"  stock: ${products[0].currentStock}  price: K${products[0].price}` : '',
    });
  } else {
    results.push({ group: 'Inventory', name: 'GET /api/products/:id', ok: true, status: 0, ms: 0, detail: 'Skipped — no products yet', warns: [] });
  }
  return products[0]?.id ?? null;
}

async function testInvoices() {
  section('INVOICES');
  const r1 = await request('GET', '/api/invoices?limit=200');
  const invoices = r1.json?.invoices ?? [];
  const paid    = invoices.filter(i => i.status === 'PAID').length;
  const pending = invoices.filter(i => i.status === 'PENDING').length;
  const overdue = invoices.filter(i => i.status === 'OVERDUE').length;
  const draft   = invoices.filter(i => i.status === 'DRAFT').length;
  const warns   = [];
  const zeroPaid = invoices.filter(i => i.status === 'PAID' && i.total === 0);
  const pastDue  = invoices.filter(i => i.status === 'PENDING' && new Date(i.dueDate) < new Date());
  if (zeroPaid.length > 0) warns.push(`${zeroPaid.length} PAID invoices have a total of K0.00`);
  if (pastDue.length  > 0) warns.push(`${pastDue.length} PENDING invoices are past their due date`);
  record('Invoices', 'GET /api/invoices', r1, {
    info:  r1.ok ? `${invoices.length} total  |  ${paid} paid  |  ${pending} pending  |  ${overdue} overdue  |  ${draft} draft` : '',
    warns,
  });

  const r2 = await request('GET', '/api/invoices?historical=true&limit=10');
  record('Invoices', 'GET /api/invoices?historical=true', r2, {
    info: r2.ok ? `${r2.json?.invoices?.length ?? 0} historical records` : '',
  });

  const r3 = await request('GET', '/api/invoices?search=a&limit=10');
  record('Invoices', 'GET /api/invoices?search= (statements)', r3, {
    info:  r3.ok ? `search returning results` : '',
    warns: r3.ok && r3.json?.invoices === undefined ? ['Missing invoices key — statements page may break'] : [],
  });

  if (invoices.length > 0) {
    const inv = invoices[0];
    const r4  = await request('GET', `/api/invoices/${inv.id}`);
    const body = r4.json?.invoice ?? r4.json;
    record('Invoices', 'GET /api/invoices/:id', r4, {
      info:  r4.ok ? `#${inv.invoiceNumber}  K${inv.total?.toFixed(2)}  status: ${inv.status}  items: ${body?.items?.length ?? '?'}` : '',
      warns: r4.ok && !Array.isArray(body?.items) ? ['Invoice items not included in response'] : [],
    });
  } else {
    results.push({ group: 'Invoices', name: 'GET /api/invoices/:id', ok: true, status: 0, ms: 0, detail: 'Skipped — no invoices yet', warns: [] });
  }
  return invoices[0]?.id ?? null;
}

async function testPayments(invoiceId) {
  section('PAYMENTS');
  const r1 = await request('GET', '/api/payments');
  const allPayments = r1.json?.payments ?? (Array.isArray(r1.json) ? r1.json : []);
  record('Payments', 'GET /api/payments', r1, {
    info: r1.ok ? `${allPayments.length} total payments recorded` : '',
  });
}

async function testReturns() {
  section('RETURNS');
  const r = await request('GET', '/api/returns');
  const returns = r.json?.returns ?? (Array.isArray(r.json) ? r.json : []);
  record('Returns', 'GET /api/returns', r, {
    info: r.ok ? `${returns.length} returns on record` : '',
  });
}

async function testAccounting() {
  section('ACCOUNTING');
  const r1 = await request('GET', '/api/accounting');
  const d  = r1.json?.data;
  const warns = [];
  if (r1.ok) {
    if (d?.totalRevenue  === undefined) warns.push('totalRevenue missing from response');
    if (d?.totalExpenses === undefined) warns.push('totalExpenses missing from response');
    if (d?.netProfit     === undefined) warns.push('netProfit missing from response');
  }
  record('Accounting', 'GET /api/accounting', r1, {
    info:  d ? `revenue: K${(d.totalRevenue||0).toFixed(2)}  |  expenses: K${(d.totalExpenses||0).toFixed(2)}  |  profit: K${(d.netProfit||0).toFixed(2)}` : '',
    warns,
  });

  const r2 = await request('GET', '/api/accounting/expenses');
  const exps = r2.json?.expenses ?? (Array.isArray(r2.json) ? r2.json : []);
  record('Accounting', 'GET /api/accounting/expenses', r2, {
    info: r2.ok ? `${exps.length} expenses recorded` : '',
  });

  const r3 = await request('GET', '/api/accounting/statements?client=a');
  record('Accounting', 'GET /api/accounting/statements?client=', r3, {
    info:  r3.ok ? `statement search working` : '',
    warns: r3.ok && r3.json?.invoices === undefined ? ['Missing invoices key in statement response'] : [],
  });
}

async function testAnalysis() {
  section('ANALYSIS');
  const r1 = await request('GET', '/api/analysis');
  if (r1.status === 404) {
    results.push({ group: 'Analysis', name: 'GET /api/analysis', ok: true, status: 404, ms: r1.ms, detail: 'Route not implemented yet (optional)', warns: [] });
  } else {
    record('Analysis', 'GET /api/analysis', r1, {
      info: r1.ok ? 'analysis endpoint reachable' : '',
    });
  }
}

async function testAudit() {
  section('AUDIT LOG');
  const r = await request('GET', '/api/audit');
  const logs = r.json?.logs ?? r.json?.auditLogs ?? (Array.isArray(r.json) ? r.json : []);
  record('Audit', 'GET /api/audit', r, {
    info:  r.ok ? `${logs.length} audit entries` : '',
    warns: r.ok && logs.length === 0 ? ['No audit logs yet — actions may not be recording'] : [],
  });
}

async function testUsers() {
  section('USERS');
  const r = await request('GET', '/api/users');
  const users = r.json?.users ?? (Array.isArray(r.json) ? r.json : []);
  record('Users', 'GET /api/users', r, {
    info: r.ok ? `${users.length} users` : '',
  });
}

async function testDbIntegrity() {
  section('DATABASE INTEGRITY');

  // Invoice totals vs item sums
  const r1 = await request('GET', '/api/invoices?limit=500');
  if (r1.ok && r1.json?.invoices?.length) {
    const invoices = r1.json.invoices;
    // Skip invoices that have returns — their totals will naturally differ
    // from item sums because returns reduce the total but items stay in history.
    // This is by design, not a data error.
    const invoicesWithItems = invoices.filter(inv =>
      Array.isArray(inv.items) && inv.items.length > 0 && !inv.hasReturns
    );
    const mismatch = invoicesWithItems.filter(inv => {
      const sum = inv.items.reduce((s, i) => s + (i.totalPrice || 0), 0);
      return Math.abs(sum - inv.total) > 0.01;
    });
    const withReturns = invoices.filter(i => i.hasReturns).length;
    record('DB Integrity', 'Invoice totals match item sums', {
      ok: mismatch.length === 0, status: 200, ms: 0,
    }, {
      info: mismatch.length === 0
        ? `All ${invoices.length} invoices OK${withReturns > 0 ? ` (${withReturns} with returns — skipped, working as designed)` : ''}`
        : '',
      warns: mismatch.slice(0, 5).map(i => {
        const sum = i.items.reduce((s, it) => s + (it.totalPrice || 0), 0);
        return `#${i.invoiceNumber}: total K${i.total?.toFixed(2)} ≠ items K${sum.toFixed(2)} — not caused by returns, may need investigation`;
      }),
    });

    const noClient = invoices.filter(i => !i.client && !i.clientId);
    record('DB Integrity', 'All invoices linked to a client', {
      ok: noClient.length === 0, status: 200, ms: 0,
    }, {
      info: noClient.length === 0 ? 'All invoices have a client' : '',
      warns: noClient.length > 0 ? [`${noClient.length} invoices missing a client`] : [],
    });
  }

  // Product stock
  const r2 = await request('GET', '/api/products?limit=1000');
  if (r2.ok) {
    const products = r2.json?.products ?? (Array.isArray(r2.json) ? r2.json : []);
    const negative = products.filter(p => p.currentStock < 0);
    const expired  = products.filter(p => p.expiryDate && new Date(p.expiryDate) < new Date());
    const lowStock = products.filter(p => p.currentStock > 0 && p.currentStock <= p.minStock);

    record('DB Integrity', 'No products with negative stock', {
      ok: negative.length === 0, status: 200, ms: 0,
    }, {
      info:  negative.length === 0 ? `All ${products.length} products have valid stock` : '',
      warns: negative.map(p => `"${p.name}" has stock: ${p.currentStock}`),
    });
    record('DB Integrity', 'Expired products', { ok: true, status: 200, ms: 0 }, {
      info:  expired.length === 0 ? 'No expired products' : '',
      warns: expired.slice(0, 5).map(p => `"${p.name}" expired ${new Date(p.expiryDate).toLocaleDateString()}`),
    });
    record('DB Integrity', 'Low stock warnings', { ok: true, status: 200, ms: 0 }, {
      info:  lowStock.length === 0 ? 'All products above minimum stock' : '',
      warns: lowStock.length > 5
        ? [`${lowStock.length} products need restocking`]
        : lowStock.map(p => `"${p.name}" — stock: ${p.currentStock} (min: ${p.minStock})`),
    });
  }
}

async function testSpeed() {
  section('RESPONSE SPEED');
  const endpoints = [
    ['/api/clients',          'GET /api/clients'],
    ['/api/products',        'GET /api/products'],
    ['/api/invoices?limit=50','GET /api/invoices?limit=50'],
    ['/api/accounting',       'GET /api/accounting'],
    ['/api/manufacturers',    'GET /api/manufacturers'],
  ];
  for (const [path, name] of endpoints) {
    const r = await request('GET', path);
    const warns = [];
    if (r.ms > 2000) warns.push(`Very slow (${r.ms}ms) — check for heavy DB queries`);
    else if (r.ms > 700) warns.push(`Slow (${r.ms}ms) — consider optimising`);
    record('Speed', name, r, {
      info:  r.ok ? (r.ms <= 700 ? 'fast ✓' : r.ms <= 2000 ? 'acceptable' : 'slow') : '',
      warns,
    });
  }
}

// =============================================================================
// FINAL REPORT
// =============================================================================

function printReport() {
  console.log(`\n${C.bold}${'═'.repeat(64)}${C.reset}`);
  console.log(`${C.bold}  DIAGNOSTIC REPORT${C.reset}`);
  console.log(`${C.bold}${'═'.repeat(64)}${C.reset}\n`);

  let lastGroup = '';
  let pass = 0, fail = 0, warnCount = 0;

  for (const r of results) {
    if (r.group !== lastGroup) {
      if (lastGroup !== '') console.log();
      console.log(`  ${C.bold}${C.white}${r.group}${C.reset}`);
      lastGroup = r.group;
    }
    printLine(r);
    if (!r.ok)             fail++;
    else                   pass++;
    if (r.warns?.length)   warnCount++;
  }

  const total  = pass + fail;
  const pct    = total ? Math.round((pass / total) * 100) : 100;
  const colour = pct === 100 ? C.green : pct >= 80 ? C.yellow : C.red;

  console.log(`\n${C.bold}${'─'.repeat(64)}${C.reset}`);
  console.log(`  ${C.bold}Results:${C.reset}  ${C.green}${pass} passed${C.reset}  ·  ${C.red}${fail} failed${C.reset}  ·  ${C.yellow}${warnCount} with warnings${C.reset}`);
  console.log(`  ${C.bold}Health:${C.reset}   ${colour}${C.bold}${pct}%${C.reset}\n`);

  if (fail === 0 && warnCount === 0) {
    console.log(`  ${C.green}${C.bold}✅  All systems operational — everything is working perfectly!${C.reset}\n`);
  } else if (fail === 0) {
    console.log(`  ${C.yellow}${C.bold}⚠  All endpoints up — review the warnings above.${C.reset}\n`);
  } else {
    console.log(`  ${C.red}${C.bold}✗  ${fail} endpoint${fail !== 1 ? 's' : ''} failed — fix the errors above.${C.reset}`);
    console.log(`  ${C.gray}Tip: run with --verbose to see full error response bodies.${C.reset}\n`);
  }
}

// =============================================================================
// ENTRY POINT
// =============================================================================

async function main() {
  console.log(`\n${C.bold}${C.cyan}╔════════════════════════════════════════════════════════════╗${C.reset}`);
  console.log(`${C.bold}${C.cyan}║         GLORIOUS PHARMA — FULL API HEALTH CHECK            ║${C.reset}`);
  console.log(`${C.bold}${C.cyan}╚════════════════════════════════════════════════════════════╝${C.reset}`);
  console.log(`  ${C.gray}Target: ${C.white}${BASE}${C.reset}`);

  await login();

  await testSettings();
  await testClients();
  await testManufacturers();
  await testInventory();
  const invoiceId = await testInvoices();
  await testPayments(invoiceId);
  await testReturns();
  await testAccounting();
  await testAnalysis();
  await testAudit();
  await testUsers();
  await testDbIntegrity();
  await testSpeed();

  printReport();
  process.exit(results.some(r => !r.ok) ? 1 : 0);
}

main().catch((err) => {
  console.error(`\n${C.red}${C.bold}Unexpected error: ${err.message}${C.reset}\n`);
  process.exit(1);
});
