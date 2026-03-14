import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function getBusinessSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [products, clients, invoices, expenses, returns_, manufacturers] = await Promise.all([
    prisma.product.findMany({
      include: { manufacturer: true, invoiceItems: true, returns: true },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      include: {
        invoices: {
          include: { items: { include: { product: { select: { name: true } } } }, payments: true },
          orderBy: { invoiceDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { isHistorical: false },
      include: {
        client: { select: { name: true, type: true, phone: true } },
        items: { include: { product: { select: { name: true, price: true } } } },
        payments: true,
      },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
    prisma.return.findMany({
      include: {
        product: { select: { name: true } },
        invoice: { select: { invoiceNumber: true, client: { select: { name: true } } } },
      },
      orderBy: { returnDate: 'desc' },
    }),
    prisma.manufacturer.findMany({
      include: { products: { select: { name: true, currentStock: true, price: true } } },
    }),
  ]);

  const now2 = new Date();

  // Financial totals
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const monthRevenue = invoices.filter(i => i.status === 'PAID' && new Date(i.invoiceDate) >= thirtyDaysAgo).reduce((s, i) => s + i.total, 0);
  const pendingValue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0);
  const overdueValue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Product sales
  const salesMap: Record<string, { name: string; units: number; revenue: number; recent: number }> = {};
  for (const inv of invoices) {
    for (const item of inv.items) {
      const n = item.product?.name ?? 'Unknown';
      if (!salesMap[n]) salesMap[n] = { name: n, units: 0, revenue: 0, recent: 0 };
      salesMap[n].units += item.quantity;
      salesMap[n].revenue += item.totalPrice;
      if (new Date(inv.invoiceDate) >= thirtyDaysAgo) salesMap[n].recent += item.quantity;
    }
  }
  const topProducts = Object.values(salesMap).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // Client stats
  const clientStats = clients.map(c => {
    const paid = c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    const unpaid = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((s, i) => s + i.total, 0);
    const overdue = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate) < now2).length;
    const recent = c.invoices.filter(i => new Date(i.invoiceDate) >= thirtyDaysAgo).length;
    const lastDate = c.invoices.length > 0 ? new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime()))).toLocaleDateString('en-GB') : 'Never';
    const products = [...new Set(c.invoices.flatMap(i => i.items.map(it => it.product?.name)).filter(Boolean))];
    return { name: c.name, type: c.type, phone: c.phone ?? 'N/A', email: c.email ?? 'N/A', address: c.address ?? 'N/A', paid, unpaid, invoices: c.invoices.length, overdue, recent, lastOrder: lastDate, products: products.slice(0, 15) };
  }).sort((a, b) => b.paid - a.paid);

  // Low stock & expiry
  const lowStock = products.filter(p => p.currentStock <= p.reorderLevel).map(p => ({ name: p.name, current: p.currentStock, min: p.minStock, reorder: p.reorderLevel, price: p.price })).sort((a, b) => a.current - b.current);
  const expiryRisk = products.map(p => ({ name: p.name, days: Math.ceil((new Date(p.expiryDate).getTime() - now2.getTime()) / 86400000), stock: p.currentStock, value: p.price * p.currentStock })).filter(p => p.days <= 180).sort((a, b) => a.days - b.days);

  // Inactive clients
  const inactive = clients.filter(c => {
    if (c.invoices.length === 0) return true;
    return new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime()))) < sixtyDaysAgo;
  }).map(c => ({ name: c.name, type: c.type, count: c.invoices.length }));

  // Expense categories
  const expCats: Record<string, number> = {};
  expenses.forEach(e => { expCats[e.category] = (expCats[e.category] ?? 0) + e.amount; });

  return {
    summary: {
      totalRevenue, monthRevenue, pendingValue, overdueValue,
      totalExpenses, netProfit: totalRevenue - totalExpenses,
      margin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) + '%' : '0%',
      clients: clients.length, products: products.length,
      invoices: invoices.length,
      paid: invoices.filter(i => i.status === 'PAID').length,
      pending: invoices.filter(i => i.status === 'PENDING').length,
      overdue: invoices.filter(i => i.status === 'OVERDUE').length,
      returns: returns_.length,
      stockValue: products.reduce((s, p) => s + p.price * p.currentStock, 0),
    },
    topProducts,
    clientStats,
    lowStock,
    expiryRisk,
    inactive,
    expCats,
    recentInvoices: invoices.slice(0, 50).map(i => ({
      number: i.invoiceNumber, client: i.client?.name, type: i.client?.type,
      status: i.status, total: i.total,
      paid: i.payments.reduce((s, p) => s + p.amount, 0),
      date: new Date(i.invoiceDate).toLocaleDateString('en-GB'),
      due: new Date(i.dueDate).toLocaleDateString('en-GB'),
    })),
    allProducts: products.map(p => ({
      name: p.name, generic: p.genericName ?? '', type: p.type,
      category: p.category ?? '', manufacturer: p.manufacturer?.name ?? '',
      batch: p.batchNumber, stock: p.currentStock, initial: p.initialStock,
      min: p.minStock, reorder: p.reorderLevel, price: p.price, unit: p.unit,
      expiry: new Date(p.expiryDate).toLocaleDateString('en-GB'),
      daysLeft: Math.ceil((new Date(p.expiryDate).getTime() - now2.getTime()) / 86400000),
      stockValue: p.price * p.currentStock,
      sold: p.invoiceItems.reduce((s, i) => s + i.quantity, 0),
      revenue: p.invoiceItems.reduce((s, i) => s + i.totalPrice, 0),
      returns: p.returns.length,
    })),
    allExpenses: expenses.map(e => ({ desc: e.description, cat: e.category, amount: e.amount, date: new Date(e.date).toLocaleDateString('en-GB') })),
    allReturns: returns_.map(r => ({ product: r.product?.name, qty: r.quantity, reason: r.reason, client: r.invoice?.client?.name ?? 'N/A', invoice: r.invoice?.invoiceNumber, date: new Date(r.returnDate).toLocaleDateString('en-GB') })),
    manufacturers: manufacturers.map(m => ({ name: m.name, parent: m.motherCompany ?? '', contact: m.contactPerson ?? '', phone: m.phone ?? '', location: m.location ?? '', products: m.products.length, stockValue: m.products.reduce((s, p) => s + p.price * p.currentStock, 0) })),
  };
}

async function callGroq(system: string, user: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set');
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${process.env.GROQ_API_KEY}` },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 800,
      temperature: 0.3,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }),
  });
  if (!res.ok) throw new Error(`Groq API error: ${res.status} - ${await res.text()}`);
  const data = await res.json();
  return data.choices?.[0]?.message?.content ?? 'No response';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, query } = body;

    const d = await getBusinessSnapshot();

    const BASE = `You are an AI analyst for Glorious Pharma (Zambia). Use real data provided. Be specific with names and numbers. Write in plain English, no markdown. Currency is ZMW. Today: ${new Date().toLocaleDateString('en-GB')}.`;

    const FIN = `Revenue: K${d.summary.totalRevenue.toFixed(2)} total, K${d.summary.monthRevenue.toFixed(2)} this month. Profit: K${d.summary.netProfit.toFixed(2)} (${d.summary.margin}). Pending: K${d.summary.pendingValue.toFixed(2)}. Overdue: K${d.summary.overdueValue.toFixed(2)}. Stock value: K${d.summary.stockValue.toFixed(2)}. Clients: ${d.summary.clients}. Products: ${d.summary.products}. Returns: ${d.summary.returns}.`;

    let aiResponse = '';

    if (type === 'insights') {
      const msg = `${FIN}

Top products: ${d.topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.units} units, K${p.revenue.toFixed(2)}`).join('; ')}

Top clients: ${d.clientStats.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: K${c.paid.toFixed(2)} paid, ${c.overdue} overdue`).join('; ')}

Low stock (${d.lowStock.length}): ${d.lowStock.slice(0, 5).map(p => `${p.name} ${p.current}u`).join(', ')}

Expiry risk (${d.expiryRisk.length}): ${d.expiryRisk.slice(0, 5).map(p => `${p.name} ${p.days}d`).join(', ')}

Inactive clients: ${d.inactive.slice(0, 5).map(c => c.name).join(', ')}

Give 5 specific business insights and actions based on this data.`;
      aiResponse = await callGroq(BASE, msg);
    }

    else if (type === 'inventory') {
      const msg = `${FIN}

Low stock: ${d.lowStock.length === 0 ? 'None' : d.lowStock.map(p => `${p.name}: ${p.current} units (reorder at ${p.reorder})`).join('; ')}

Expiry risk: ${d.expiryRisk.length === 0 ? 'None' : d.expiryRisk.map(p => `${p.name}: ${p.days} days, ${p.stock} units, K${p.value.toFixed(2)} at risk`).join('; ')}

Top sellers this month: ${d.topProducts.slice(0, 5).map(p => `${p.name}: ${p.recent} units`).join('; ')}

Give a clear inventory action plan with urgent restocking needs and expiry risk management.`;
      aiResponse = await callGroq(BASE, msg);
    }

    else if (type === 'clients') {
      const highRisk = d.clientStats.filter(c => c.overdue > 0 || c.unpaid > 0);
      const msg = `${FIN}

High risk clients: ${highRisk.slice(0, 8).map(c => `${c.name}: K${c.unpaid.toFixed(2)} outstanding, ${c.overdue} overdue invoices`).join('; ')}

Top clients: ${d.clientStats.slice(0, 8).map((c, i) => `${i + 1}. ${c.name} (${c.type}): K${c.paid.toFixed(2)} paid, ${c.invoices} invoices, last order ${c.lastOrder}`).join('; ')}

Inactive 60+ days: ${d.inactive.length === 0 ? 'None' : d.inactive.map(c => `${c.name} (${c.type})`).join(', ')}

Give client risk assessment and re-engagement recommendations.`;
      aiResponse = await callGroq(BASE, msg);
    }

    else if (type === 'financial') {
      const expList = Object.entries(d.expCats).map(([cat, amt]) => `${cat}: K${(amt as number).toFixed(2)}`).join('; ');
      const msg = `${FIN}

Invoices: ${d.summary.paid} paid, ${d.summary.pending} pending, ${d.summary.overdue} overdue.

Expenses by category: ${expList}

Recent expenses: ${d.allExpenses.slice(0, 10).map(e => `${e.cat}: K${e.amount.toFixed(2)}`).join('; ')}

Analyse financial health, profit margin, overdue risk, and give improvement recommendations.`;
      aiResponse = await callGroq(BASE, msg);
    }

    else if (type === 'chat' && query) {
      const q = query.toLowerCase();
      const parts: string[] = [FIN];

      if (q.match(/client|customer|pharmacy|hospital|who|buyer/)) {
        parts.push('CLIENTS: ' + d.clientStats.slice(0, 15).map(c => `${c.name}(${c.type}) paid K${c.paid.toFixed(2)} unpaid K${c.unpaid.toFixed(2)} invoices:${c.invoices} overdue:${c.overdue} last:${c.lastOrder}`).join(' | '));
      }
      if (q.match(/product|stock|medicine|drug|item|inventory|tablet|capsule|syrup|injection/)) {
        parts.push('PRODUCTS: ' + d.allProducts.slice(0, 30).map(p => `${p.name}(${p.type}) stock:${p.stock} price:K${p.price} exp:${p.expiry}(${p.daysLeft}d) sold:${p.sold} rev:K${p.revenue.toFixed(2)}`).join(' | '));
      }
      if (q.match(/top|best|most|highest|leading/)) {
        parts.push('TOP PRODUCTS: ' + d.topProducts.map((p, i) => `${i + 1}.${p.name} ${p.units}units K${p.revenue.toFixed(2)} ${p.recent}this month`).join(' | '));
        parts.push('TOP CLIENTS: ' + d.clientStats.slice(0, 8).map((c, i) => `${i + 1}.${c.name} K${c.paid.toFixed(2)} ${c.invoices}invoices`).join(' | '));
      }
      if (q.match(/expir/)) {
        parts.push('EXPIRY: ' + (d.expiryRisk.length === 0 ? 'None' : d.expiryRisk.slice(0, 15).map(p => `${p.name} ${p.days}days ${p.stock}units K${p.value.toFixed(2)}`).join(' | ')));
      }
      if (q.match(/low stock|reorder|shortage|running out/)) {
        parts.push('LOW STOCK: ' + (d.lowStock.length === 0 ? 'None' : d.lowStock.slice(0, 15).map(p => `${p.name} ${p.current}units reorder@${p.reorder}`).join(' | ')));
      }
      if (q.match(/invoice|order|sale|payment|paid|overdue|pending/)) {
        parts.push('INVOICES: ' + d.recentInvoices.slice(0, 20).map(i => `${i.number} ${i.client} ${i.status} K${i.total.toFixed(2)} ${i.date}`).join(' | '));
      }
      if (q.match(/expense|cost|spending/)) {
        parts.push('EXPENSES: ' + Object.entries(d.expCats).map(([c, a]) => `${c}:K${(a as number).toFixed(2)}`).join(' | '));
      }
      if (q.match(/return|refund/)) {
        parts.push('RETURNS: ' + (d.allReturns.length === 0 ? 'None' : d.allReturns.slice(0, 10).map(r => `${r.product} x${r.qty} ${r.reason} ${r.client}`).join(' | ')));
      }
      if (q.match(/manufacturer|supplier|vendor/)) {
        parts.push('MANUFACTURERS: ' + d.manufacturers.map(m => `${m.name}(${m.parent}) ${m.products}products K${m.stockValue.toFixed(2)}`).join(' | '));
      }
      if (q.match(/inactive|not ordered|lost/)) {
        parts.push('INACTIVE: ' + (d.inactive.length === 0 ? 'None' : d.inactive.map(c => `${c.name}(${c.type}) ${c.count}invoices`).join(' | ')));
      }

      // Fallback if no keyword matched
      if (parts.length === 1) {
        parts.push('TOP CLIENTS: ' + d.clientStats.slice(0, 8).map((c, i) => `${i + 1}.${c.name} K${c.paid.toFixed(2)} ${c.invoices}inv`).join(' | '));
        parts.push('TOP PRODUCTS: ' + d.topProducts.slice(0, 8).map((p, i) => `${i + 1}.${p.name} ${p.units}units K${p.revenue.toFixed(2)}`).join(' | '));
      }

      aiResponse = await callGroq(BASE + '\n\nData:\n' + parts.join('\n'), query);
    }

    else {
      return NextResponse.json({ error: 'Invalid type' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      dataSnapshot: {
        totalRevenue: d.summary.totalRevenue,
        monthRevenue: d.summary.monthRevenue,
        pendingValue: d.summary.pendingValue,
        overdueValue: d.summary.overdueValue,
        netProfit: d.summary.netProfit,
        lowStockCount: d.lowStock.length,
        expiryRiskCount: d.expiryRisk.filter(p => p.days <= 30).length,
        topProducts: d.topProducts.slice(0, 5),
        clientStats: d.clientStats.slice(0, 5).map(c => ({ name: c.name, type: c.type, totalPaid: c.paid, totalUnpaid: c.unpaid, overdueCount: c.overdue, invoiceCount: c.invoices })),
        lowStock: d.lowStock.slice(0, 5).map(p => ({ name: p.name, currentStock: p.current, reorderLevel: p.reorder })),
        expiryRisk: d.expiryRisk.slice(0, 5).map(p => ({ name: p.name, daysLeft: p.days, currentStock: p.stock })),
        inactiveClients: d.inactive,
      },
    });

  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: error.message ?? 'AI analysis failed' }, { status: 500 });
  }
}
