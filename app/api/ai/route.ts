// app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

// ── Pull EVERYTHING from the database ────────────────────────────────────────
async function getFullDatabaseSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [products, clients, invoices, expenses, returns_, manufacturers, payments, settings, users] = await Promise.all([

    prisma.product.findMany({
      include: {
        manufacturer: true,
        invoiceItems: {
          include: {
            invoice: { include: { client: { select: { name: true } } } },
          },
        },
        returns: {
          include: {
            invoice: { include: { client: { select: { name: true } } } },
          },
        },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.client.findMany({
      include: {
        invoices: {
          include: {
            items: {
              include: {
                product: { select: { name: true, type: true, category: true, unit: true } },
              },
            },
            payments: true,
            returns: { include: { product: { select: { name: true } } } },
          },
          orderBy: { invoiceDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    }),

    prisma.invoice.findMany({
      include: {
        client: true,
        items: {
          include: {
            product: { include: { manufacturer: { select: { name: true } } } },
          },
        },
        payments: true,
        returns: { include: { product: { select: { name: true } } } },
      },
      orderBy: { invoiceDate: 'desc' },
    }),

    prisma.expense.findMany({ orderBy: { date: 'desc' } }),

    prisma.return.findMany({
      include: {
        product: true,
        invoice: { include: { client: { select: { name: true } } } },
      },
      orderBy: { returnDate: 'desc' },
    }),

    prisma.manufacturer.findMany({
      include: { products: true },
      orderBy: { name: 'asc' },
    }),

    prisma.payment.findMany({
      include: {
        invoice: { include: { client: { select: { name: true } } } },
      },
      orderBy: { paymentDate: 'desc' },
    }),

    prisma.setting.findMany(),

    prisma.user.findMany({
      select: {
        name: true, email: true, role: true,
        isActive: true, lastLoginAt: true, createdAt: true,
      },
      orderBy: { name: 'asc' },
    }),
  ]);

  // ── Build complete product profiles ─────────────────────────────────────────
  const productProfiles = products.map(p => {
    const daysToExpiry = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
    const totalSold = p.invoiceItems.reduce((s, item) => s + item.quantity, 0);
    const soldThisMonth = p.invoiceItems
      .filter(item => new Date(item.invoice.invoiceDate) >= thirtyDaysAgo)
      .reduce((s, item) => s + item.quantity, 0);
    const totalRevenue = p.invoiceItems.reduce((s, item) => s + item.totalPrice, 0);
    const totalReturned = p.returns.reduce((s, r) => s + r.quantity, 0);
    const clientsBought = [...new Set(p.invoiceItems.map(item => item.invoice.client?.name).filter(Boolean))];

    return {
      name: p.name,
      genericName: p.genericName,
      type: p.type,
      category: p.category,
      batchNumber: p.batchNumber,
      expiryDate: new Date(p.expiryDate).toLocaleDateString('en-GB'),
      daysToExpiry,
      unit: p.unit,
      price: p.price,
      currentStock: p.currentStock,
      initialStock: p.initialStock,
      minStock: p.minStock,
      reorderLevel: p.reorderLevel,
      manufacturer: p.manufacturer.name,
      totalSold,
      soldThisMonth,
      totalRevenue,
      totalReturned,
      stockValue: p.currentStock * p.price,
      isLowStock: p.currentStock <= p.reorderLevel,
      isExpiringSoon: daysToExpiry > 0 && daysToExpiry <= 90,
      isExpired: daysToExpiry <= 0,
      clientsBought,
    };
  });

  // ── Build complete client profiles ──────────────────────────────────────────
  const clientProfiles = clients.map(c => {
    const allInvoices = c.invoices;
    const paidInvoices = allInvoices.filter(i => i.status === 'PAID');
    const pendingInvoices = allInvoices.filter(i => i.status === 'PENDING');
    const overdueInvoices = allInvoices.filter(i => i.status === 'OVERDUE' || (i.status === 'PENDING' && new Date(i.dueDate) < now));
    const totalPaid = paidInvoices.reduce((s, i) => s + i.total, 0);
    const totalOutstanding = pendingInvoices.reduce((s, i) => s + i.total, 0);
    const totalPaymentsReceived = allInvoices.flatMap(i => i.payments).reduce((s, p) => s + p.amount, 0);
    const totalReturns = allInvoices.reduce((s, i) => s + i.returns.length, 0);
    const creditUtil = c.creditLimit ? (totalOutstanding / c.creditLimit) * 100 : 0;
    const productsBought = [...new Set(allInvoices.flatMap(i => i.items.map(item => item.product?.name)).filter(Boolean))];
    const lastOrderDate = allInvoices.length > 0
      ? new Date(Math.max(...allInvoices.map(i => new Date(i.invoiceDate).getTime()))).toLocaleDateString('en-GB')
      : 'Never';
    const isInactive = allInvoices.length === 0 ||
      new Date(Math.max(...allInvoices.map(i => new Date(i.invoiceDate).getTime()))) < sixtyDaysAgo;

    return {
      name: c.name,
      type: c.type,
      email: c.email,
      phone: c.phone,
      address: c.address,
      company: c.company,
      creditLimit: c.creditLimit ?? 0,
      creditUtilization: Math.round(creditUtil),
      totalPaid,
      totalOutstanding,
      totalPaymentsReceived,
      totalReturns,
      invoiceCount: allInvoices.length,
      paidCount: paidInvoices.length,
      pendingCount: pendingInvoices.length,
      overdueCount: overdueInvoices.length,
      draftCount: allInvoices.filter(i => i.status === 'DRAFT').length,
      cancelledCount: allInvoices.filter(i => i.status === 'CANCELLED').length,
      recentOrderCount: allInvoices.filter(i => new Date(i.invoiceDate) >= thirtyDaysAgo).length,
      lastOrderDate,
      isInactive,
      productsBought,
      invoices: allInvoices.map(i => ({
        invoiceNumber: i.invoiceNumber,
        status: i.status,
        total: i.total,
        invoiceDate: new Date(i.invoiceDate).toLocaleDateString('en-GB'),
        dueDate: new Date(i.dueDate).toLocaleDateString('en-GB'),
        amountPaid: i.payments.reduce((s, p) => s + p.amount, 0),
        balance: i.total - i.payments.reduce((s, p) => s + p.amount, 0),
        notes: i.notes,
        returns: i.returns.length,
        items: i.items.map(item => ({
          product: item.product?.name ?? 'Unknown',
          quantity: item.quantity,
          freeSamples: item.freeSamples,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
        })),
        payments: i.payments.map(p => ({
          amount: p.amount,
          method: p.method,
          date: new Date(p.paymentDate).toLocaleDateString('en-GB'),
          chequeNumber: p.chequeNumber,
          bankName: p.bankName,
        })),
      })),
    };
  }).sort((a, b) => b.totalPaid - a.totalPaid);

  // ── Financial summary ───────────────────────────────────────────────────────
  const activeInvoices = invoices.filter(i => !i.isHistorical);
  const totalRevenue = activeInvoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const monthRevenue = activeInvoices.filter(i => i.status === 'PAID' && new Date(i.invoiceDate) >= thirtyDaysAgo).reduce((s, i) => s + i.total, 0);
  const pendingValue = activeInvoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0);
  const overdueValue = activeInvoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
  const totalPayments = payments.reduce((s, p) => s + p.amount, 0);

  const expenseByCategory: Record<string, number> = {};
  for (const e of expenses) expenseByCategory[e.category] = (expenseByCategory[e.category] ?? 0) + e.amount;

  const paymentBreakdown = {
    cash: payments.filter(p => p.method === 'CASH').reduce((s, p) => s + p.amount, 0),
    cheque: payments.filter(p => p.method === 'CHEQUE').reduce((s, p) => s + p.amount, 0),
    bankTransfer: payments.filter(p => p.method === 'BANK_TRANSFER').reduce((s, p) => s + p.amount, 0),
  };

  return {
    products: productProfiles,
    clients: clientProfiles,
    manufacturers: manufacturers.map(m => ({
      name: m.name,
      contactPerson: m.contactPerson,
      phone: m.phone,
      email: m.email,
      motherCompany: m.motherCompany,
      address: m.address,
      location: m.location,
      productCount: m.products.length,
      products: m.products.map(p => p.name).join(', '),
    })),
    returns: returns_.map(r => ({
      product: r.product.name,
      client: r.invoice.client.name,
      quantity: r.quantity,
      reason: r.reason,
      date: new Date(r.returnDate).toLocaleDateString('en-GB'),
    })),
    expenses: expenses.map(e => ({
      description: e.description,
      amount: e.amount,
      category: e.category,
      date: new Date(e.date).toLocaleDateString('en-GB'),
    })),
    payments: payments.slice(0, 50).map(p => ({
      amount: p.amount,
      method: p.method,
      client: p.invoice.client.name,
      date: new Date(p.paymentDate).toLocaleDateString('en-GB'),
      chequeNumber: p.chequeNumber,
      bankName: p.bankName,
      notes: p.notes,
    })),
    users: users.map(u => ({
      name: u.name,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      lastLogin: u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleDateString('en-GB') : 'Never',
    })),
    settings: Object.fromEntries(settings.map(s => [s.key, s.value])),
    summary: {
      totalRevenue, monthRevenue, pendingValue, overdueValue,
      totalExpenses, netProfit: totalRevenue - totalExpenses, totalPayments,
      totalClients: clients.length, totalProducts: products.length,
      totalManufacturers: manufacturers.length,
      totalInvoices: activeInvoices.length,
      paidInvoices: activeInvoices.filter(i => i.status === 'PAID').length,
      pendingInvoices: activeInvoices.filter(i => i.status === 'PENDING').length,
      overdueInvoices: activeInvoices.filter(i => i.status === 'OVERDUE').length,
      draftInvoices: activeInvoices.filter(i => i.status === 'DRAFT').length,
      cancelledInvoices: activeInvoices.filter(i => i.status === 'CANCELLED').length,
      totalReturns: returns_.length,
      lowStockProducts: products.filter(p => p.currentStock <= p.reorderLevel).length,
      expiringProducts: products.filter(p => {
        const d = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
        return d > 0 && d <= 90;
      }).length,
      expiredProducts: products.filter(p => new Date(p.expiryDate) < now).length,
      inactiveClients: clientProfiles.filter(c => c.isInactive).length,
      expenseByCategory,
      paymentBreakdown,
    },
  };
}

// ── Call Groq AI ──────────────────────────────────────────────────────────────
async function callGroqAI(systemPrompt: string, userMessage: string): Promise<string> {
  console.log('🔍 [GroqAI] Starting request...');
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in .env.local');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1500,
      temperature: 0.3,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userMessage },
      ],
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Groq API error: ${response.status} - ${error}`);
  }

  const result = await response.json();
  const text = result.choices?.[0]?.message?.content;
  if (!text) throw new Error('Unexpected response format from Groq');
  console.log('✅ [GroqAI] Got response');
  return text;
}

// ── Smart context builder ─────────────────────────────────────────────────────
function buildContext(query: string, data: Awaited<ReturnType<typeof getFullDatabaseSnapshot>>): string {
  const q = query.toLowerCase();

  const mentionedClient = data.clients.find(c => q.includes(c.name.toLowerCase()));
  const mentionedProduct = data.products.find(p => q.includes(p.name.toLowerCase()));
  const mentionedManufacturer = data.manufacturers.find(m => q.includes(m.name.toLowerCase()));

  const isAboutInvoices = /invoice|bill|order|receipt/.test(q);
  const isAboutStock = /stock|inventory|remain|left|units|expir|batch/.test(q);
  const isAboutFinance = /revenue|profit|expense|payment|money|paid|overdue|pending|cash|cheque|bank|earn|income/.test(q);
  const isAboutClients = /client|customer|hospital|pharmacy|company|individual/.test(q) || !!mentionedClient;
  const isAboutProducts = /product|medicine|drug|tablet|capsule|syrup|injection|ointment/.test(q) || !!mentionedProduct;
  const isAboutReturns = /return|refund/.test(q);
  const isAboutManufacturer = /manufacturer|supplier|vendor/.test(q) || !!mentionedManufacturer;
  const isAboutUsers = /user|staff|employee|role|admin|pharmacist/.test(q);
  const isAboutSettings = /setting|config|company|currency/.test(q);

  let ctx = `=== BUSINESS SUMMARY ===
Revenue: ZMW ${data.summary.totalRevenue.toFixed(2)} all time | ZMW ${data.summary.monthRevenue.toFixed(2)} this month
Net profit: ZMW ${data.summary.netProfit.toFixed(2)} | Expenses: ZMW ${data.summary.totalExpenses.toFixed(2)}
Invoices: ${data.summary.totalInvoices} total (${data.summary.paidInvoices} paid, ${data.summary.pendingInvoices} pending, ${data.summary.overdueInvoices} overdue, ${data.summary.draftInvoices} draft)
Pending: ZMW ${data.summary.pendingValue.toFixed(2)} | Overdue: ZMW ${data.summary.overdueValue.toFixed(2)}
Clients: ${data.summary.totalClients} | Products: ${data.summary.totalProducts} | Returns: ${data.summary.totalReturns}
Low stock: ${data.summary.lowStockProducts} | Expiring (90d): ${data.summary.expiringProducts} | Expired: ${data.summary.expiredProducts}
`;

  if (mentionedClient) {
    const c = mentionedClient;
    ctx += `
=== FULL CLIENT PROFILE: ${c.name.toUpperCase()} ===
Type: ${c.type} | Phone: ${c.phone ?? 'N/A'} | Email: ${c.email ?? 'N/A'}
Address: ${c.address ?? 'N/A'} | Company: ${c.company ?? 'N/A'}
Credit limit: ZMW ${c.creditLimit} | Used: ${c.creditUtilization}%
Total paid: ZMW ${c.totalPaid.toFixed(2)} | Outstanding: ZMW ${c.totalOutstanding.toFixed(2)} | Payments received: ZMW ${c.totalPaymentsReceived.toFixed(2)}
Invoices: ${c.invoiceCount} (${c.paidCount} paid, ${c.pendingCount} pending, ${c.overdueCount} overdue, ${c.draftCount} draft, ${c.cancelledCount} cancelled)
Recent orders (30d): ${c.recentOrderCount} | Returns: ${c.totalReturns} | Last order: ${c.lastOrderDate}
Products ever purchased: ${c.productsBought.join(', ') || 'None'}

INVOICE HISTORY:
${c.invoices.map(i =>
  `  ${i.invoiceNumber} | ${i.status} | ZMW ${i.total.toFixed(2)} | Date: ${i.invoiceDate} | Due: ${i.dueDate} | Paid: ZMW ${i.amountPaid.toFixed(2)} | Balance: ZMW ${i.balance.toFixed(2)}
    Items: ${i.items.map(item => `${item.product} x${item.quantity} (${item.freeSamples} free) @ ZMW ${item.unitPrice} = ZMW ${item.totalPrice}`).join(', ')}
    Payments: ${i.payments.length > 0 ? i.payments.map(p => `ZMW ${p.amount} via ${p.method} on ${p.date}${p.chequeNumber ? ' cheque#' + p.chequeNumber : ''}${p.bankName ? ' bank:' + p.bankName : ''}`).join(', ') : 'None'}
    Returns: ${i.returns} | Notes: ${i.notes ?? 'None'}`
).join('\n')}
`;
  }

  if (mentionedProduct) {
    const p = mentionedProduct;
    ctx += `
=== FULL PRODUCT PROFILE: ${p.name.toUpperCase()} ===
Generic: ${p.genericName ?? 'N/A'} | Type: ${p.type} | Category: ${p.category ?? 'N/A'} | Unit: ${p.unit}
Manufacturer: ${p.manufacturer} | Batch: ${p.batchNumber}
Price: ZMW ${p.price} | Current stock: ${p.currentStock} units | Initial stock: ${p.initialStock}
Min stock: ${p.minStock} | Reorder level: ${p.reorderLevel} | Stock value: ZMW ${p.stockValue.toFixed(2)}
Status: ${p.isExpired ? 'EXPIRED ❌' : p.isExpiringSoon ? 'EXPIRING SOON ⚠️' : 'OK'} | ${p.isLowStock ? 'LOW STOCK ⚠️' : 'Stock OK'}
Expiry: ${p.expiryDate} (${p.daysToExpiry} days left)
Total sold: ${p.totalSold} units | This month: ${p.soldThisMonth} | Returned: ${p.totalReturned}
Revenue generated: ZMW ${p.totalRevenue.toFixed(2)}
Clients who bought this: ${p.clientsBought.join(', ') || 'None'}
`;
  }

  if (mentionedManufacturer) {
    const m = mentionedManufacturer;
    ctx += `
=== MANUFACTURER: ${m.name.toUpperCase()} ===
Contact: ${m.contactPerson ?? 'N/A'} | Phone: ${m.phone ?? 'N/A'} | Email: ${m.email ?? 'N/A'}
Mother company: ${m.motherCompany ?? 'N/A'} | Location: ${m.location ?? 'N/A'} | Address: ${m.address ?? 'N/A'}
Products (${m.productCount}): ${m.products}
`;
  }

  if (isAboutClients && !mentionedClient) {
    ctx += `
=== ALL CLIENTS ===
${data.clients.map(c => `${c.name} (${c.type}): ${c.invoiceCount} invoices | paid ZMW ${c.totalPaid.toFixed(2)} | outstanding ZMW ${c.totalOutstanding.toFixed(2)} | ${c.overdueCount} overdue | last order: ${c.lastOrderDate} | ${c.isInactive ? 'INACTIVE' : 'Active'}`).join('\n')}
`;
  }

  if ((isAboutProducts || isAboutStock) && !mentionedProduct) {
    ctx += `
=== ALL PRODUCTS ===
${data.products.map(p => `${p.name}: stock=${p.currentStock} | price=ZMW ${p.price} | sold=${p.totalSold}/${p.soldThisMonth}mo | expires=${p.expiryDate}(${p.daysToExpiry}d) | manufacturer=${p.manufacturer}${p.isLowStock ? ' ⚠️LOW' : ''}${p.isExpired ? ' ❌EXPIRED' : p.isExpiringSoon ? ' ⚠️EXPIRING' : ''}`).join('\n')}
`;
  }

  if (isAboutInvoices && !mentionedClient) {
    ctx += `
=== RECENT INVOICES (last 30) ===
${data.clients.flatMap(c => c.invoices.map(i => ({ ...i, clientName: c.name }))).sort((a, b) => new Date(b.invoiceDate).getTime() - new Date(a.invoiceDate).getTime()).slice(0, 30).map(i => `${i.invoiceNumber} | ${i.clientName} | ${i.status} | ZMW ${i.total.toFixed(2)} | ${i.invoiceDate} | Due: ${i.dueDate} | Paid: ZMW ${i.amountPaid.toFixed(2)} | Balance: ZMW ${i.balance.toFixed(2)}`).join('\n')}
`;
  }

  if (isAboutFinance) {
    ctx += `
=== EXPENSES BY CATEGORY ===
${Object.entries(data.summary.expenseByCategory).map(([cat, amt]) => `${cat}: ZMW ${(amt as number).toFixed(2)}`).join(' | ')}
=== PAYMENT METHODS ===
Cash: ZMW ${data.summary.paymentBreakdown.cash.toFixed(2)} | Cheque: ZMW ${data.summary.paymentBreakdown.cheque.toFixed(2)} | Bank Transfer: ZMW ${data.summary.paymentBreakdown.bankTransfer.toFixed(2)}
=== RECENT EXPENSES ===
${data.expenses.slice(0, 15).map(e => `${e.date}: ${e.description} (${e.category}) ZMW ${e.amount.toFixed(2)}`).join('\n')}
`;
  }

  if (isAboutReturns) {
    ctx += `
=== ALL RETURNS ===
${data.returns.length === 0 ? 'No returns recorded.' : data.returns.map(r => `${r.date}: ${r.product} x${r.quantity} from ${r.client} — ${r.reason}`).join('\n')}
`;
  }

  if (isAboutManufacturer && !mentionedManufacturer) {
    ctx += `
=== ALL MANUFACTURERS ===
${data.manufacturers.map(m => `${m.name}: ${m.productCount} products (${m.products}) | ${m.location ?? 'N/A'} | ${m.phone ?? 'N/A'}`).join('\n')}
`;
  }

  if (isAboutUsers) {
    ctx += `
=== SYSTEM USERS ===
${data.users.map(u => `${u.name} (${u.role}): ${u.email} | Active: ${u.isActive} | Last login: ${u.lastLogin}`).join('\n')}
`;
  }

  if (isAboutSettings) {
    ctx += `
=== SYSTEM SETTINGS ===
${Object.entries(data.settings).map(([k, v]) => `${k}: ${v}`).join('\n')}
`;
  }

  return ctx;
}

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log('\n=== 🤖 AI API CALLED ===');
  console.log('📝 Request time:', new Date().toISOString());

  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    if (!process.env.GROQ_API_KEY) {
      return NextResponse.json({ error: 'GROQ_API_KEY not set in .env.local' }, { status: 500 });
    }

    const { type, query } = await request.json();
    console.log('📊 Type:', type, '| Query:', query || 'N/A');

    console.log('📊 Fetching full database...');
    const data = await getFullDatabaseSnapshot();
    console.log('✅ Database fetched');

    const BASE_SYSTEM = `You are an AI business analyst for Glorious Pharma with access to the complete live database.
Always use exact numbers, names, and dates from the data. Never guess or invent data.
If something is not in the provided data, say so clearly — do NOT make up numbers.
Currency is ZMW (Zambian Kwacha). Today is ${new Date().toLocaleDateString('en-GB')}.
Respond in plain English. Be concise, specific, and direct.`;

    let aiResponse = '';

    if (type === 'insights') {
      const ctx = `
Revenue this month: ZMW ${data.summary.monthRevenue.toFixed(2)} | All time: ZMW ${data.summary.totalRevenue.toFixed(2)}
Net profit: ZMW ${data.summary.netProfit.toFixed(2)} | Expenses: ZMW ${data.summary.totalExpenses.toFixed(2)}
Pending: ZMW ${data.summary.pendingValue.toFixed(2)} | Overdue: ZMW ${data.summary.overdueValue.toFixed(2)}
Invoices: ${data.summary.paidInvoices} paid, ${data.summary.pendingInvoices} pending, ${data.summary.overdueInvoices} overdue

TOP 5 CLIENTS:
${data.clients.slice(0, 5).map((c, i) => `${i + 1}. ${c.name}: ZMW ${c.totalPaid.toFixed(2)} paid, ZMW ${c.totalOutstanding.toFixed(2)} outstanding, ${c.overdueCount} overdue`).join('\n')}

TOP 5 PRODUCTS:
${data.products.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5).map((p, i) => `${i + 1}. ${p.name}: ZMW ${p.totalRevenue.toFixed(2)} revenue, ${p.totalSold} sold, ${p.currentStock} in stock`).join('\n')}

LOW STOCK: ${data.products.filter(p => p.isLowStock).map(p => `${p.name}: ${p.currentStock} units`).join(', ') || 'None'}
EXPIRING SOON: ${data.products.filter(p => p.isExpiringSoon).map(p => `${p.name}: ${p.daysToExpiry} days`).join(', ') || 'None'}
INACTIVE CLIENTS: ${data.clients.filter(c => c.isInactive).map(c => c.name).join(', ') || 'None'}
`;
      aiResponse = await callGroqAI(BASE_SYSTEM, `Give me 5-6 sharp business insights and action items based on this data:\n${ctx}`);
    }

    else if (type === 'inventory') {
      const ctx = data.products.map(p =>
        `${p.name}: stock=${p.currentStock} | min=${p.minStock} | reorder=${p.reorderLevel} | expires=${p.expiryDate}(${p.daysToExpiry}d) | price=ZMW ${p.price} | sold=${p.totalSold} | manufacturer=${p.manufacturer}${p.isLowStock ? ' ⚠️LOW' : ''}${p.isExpired ? ' ❌EXPIRED' : p.isExpiringSoon ? ' ⚠️EXPIRING' : ''}`
      ).join('\n');
      aiResponse = await callGroqAI(BASE_SYSTEM, `Analyse the full inventory and give a clear action plan:\n${ctx}`);
    }

    else if (type === 'clients') {
      const ctx = data.clients.map(c =>
        `${c.name}(${c.type}): paid=ZMW ${c.totalPaid.toFixed(2)} outstanding=ZMW ${c.totalOutstanding.toFixed(2)} overdue=${c.overdueCount} credit=${c.creditUtilization}% lastOrder=${c.lastOrderDate} inactive=${c.isInactive}`
      ).join('\n');
      aiResponse = await callGroqAI(BASE_SYSTEM, `Analyse all clients — risk, opportunities, re-engagement:\n${ctx}`);
    }

    else if (type === 'financial') {
      const ctx = `
Revenue: ZMW ${data.summary.totalRevenue.toFixed(2)} | Month: ZMW ${data.summary.monthRevenue.toFixed(2)}
Expenses: ZMW ${data.summary.totalExpenses.toFixed(2)} | Profit: ZMW ${data.summary.netProfit.toFixed(2)}
Pending: ZMW ${data.summary.pendingValue.toFixed(2)} | Overdue: ZMW ${data.summary.overdueValue.toFixed(2)}
Payments: Cash ZMW ${data.summary.paymentBreakdown.cash.toFixed(2)} | Cheque ZMW ${data.summary.paymentBreakdown.cheque.toFixed(2)} | Bank ZMW ${data.summary.paymentBreakdown.bankTransfer.toFixed(2)}
By category: ${Object.entries(data.summary.expenseByCategory).map(([k, v]) => `${k}: ZMW ${(v as number).toFixed(2)}`).join(', ')}
Recent expenses: ${data.expenses.slice(0, 10).map(e => `${e.description} ZMW ${e.amount.toFixed(2)}`).join(', ')}
`;
      aiResponse = await callGroqAI(BASE_SYSTEM, `Financial health analysis:\n${ctx}`);
    }

    else if (type === 'chat' && query) {
      const context = buildContext(query, data);
      aiResponse = await callGroqAI(
        `${BASE_SYSTEM}\n\nRelevant live data from the database:\n${context}`,
        `${query}\n\nAnswer using only the data provided. Be specific. Do not invent or estimate anything not in the data.`
      );
    }

    else {
      return NextResponse.json({ error: 'Invalid type. Use: insights, inventory, clients, financial, chat' }, { status: 400 });
    }

    console.log('✅ Response generated');

    return NextResponse.json({
      success: true,
      response: aiResponse,
      dataSnapshot: {
        totalRevenue: data.summary.totalRevenue,
        monthRevenue: data.summary.monthRevenue,
        pendingValue: data.summary.pendingValue,
        overdueValue: data.summary.overdueValue,
        netProfit: data.summary.netProfit,
        lowStockCount: data.summary.lowStockProducts,
        expiryRiskCount: data.summary.expiringProducts,
        topProducts: data.products.sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 5),
        clientStats: data.clients.slice(0, 5),
        lowStock: data.products.filter(p => p.isLowStock).slice(0, 5),
        expiryRisk: data.products.filter(p => p.isExpiringSoon).slice(0, 5),
        inactiveClients: data.clients.filter(c => c.isInactive),
      },
    });

  } catch (error: any) {
    console.error('❌ AI route error:', error);
    return NextResponse.json({ error: error.message ?? 'AI analysis failed' }, { status: 500 });
  }
}
