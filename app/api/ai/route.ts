import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function getBusinessSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

  const [products, clients, invoices, expenses, returns_, manufacturers, users, settings] = await Promise.all([
    prisma.product.findMany({
      include: {
        manufacturer: true,
        invoiceItems: {
          include: {
            invoice: {
              select: {
                invoiceNumber: true, invoiceDate: true, status: true,
                client: { select: { name: true, type: true } },
              },
            },
          },
        },
        returns: true,
      },
      orderBy: { name: 'asc' },
    }),
    prisma.client.findMany({
      include: {
        invoices: {
          include: {
            items: {
              include: {
                product: { select: { name: true, type: true, category: true, genericName: true } },
              },
            },
            payments: true,
          },
          orderBy: { invoiceDate: 'desc' },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.invoice.findMany({
      where: { isHistorical: false },
      include: {
        client: { select: { name: true, type: true, phone: true, email: true, address: true, company: true } },
        items: {
          include: {
            product: { select: { name: true, type: true, category: true, genericName: true, price: true } },
          },
        },
        payments: true,
        returns: {
          include: { product: { select: { name: true } } },
        },
      },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
    prisma.return.findMany({
      include: {
        product: { select: { name: true, type: true, category: true, genericName: true } },
        invoice: {
          select: {
            invoiceNumber: true,
            client: { select: { name: true } },
          },
        },
      },
      orderBy: { returnDate: 'desc' },
    }),
    prisma.manufacturer.findMany({
      include: {
        products: {
          select: { name: true, currentStock: true, price: true, type: true, category: true, expiryDate: true },
        },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.user.findMany({
      select: { name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.setting.findMany(),
  ]);

  // ── Product sales analysis ──
  const productSales: Record<string, { name: string; unitsSold: number; revenue: number; recentUnits: number; freeSamples: number }> = {};
  for (const inv of invoices) {
    for (const item of inv.items) {
      const name = item.product?.name ?? 'Unknown';
      if (!productSales[name]) productSales[name] = { name, unitsSold: 0, revenue: 0, recentUnits: 0, freeSamples: 0 };
      productSales[name].unitsSold += item.quantity;
      productSales[name].revenue += item.totalPrice;
      productSales[name].freeSamples += item.freeSamples;
      if (new Date(inv.invoiceDate) >= thirtyDaysAgo) productSales[name].recentUnits += item.quantity;
    }
  }
  const topProducts = Object.values(productSales).sort((a, b) => b.revenue - a.revenue).slice(0, 10);

  // ── Client analysis ──
  const clientStats = clients.map(c => {
    const paid = c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    const unpaid = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((s, i) => s + i.total, 0);
    const overdue = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate) < now);
    const recent = c.invoices.filter(i => new Date(i.invoiceDate) >= thirtyDaysAgo).length;
    const creditUtil = c.creditLimit ? (unpaid / c.creditLimit) * 100 : 0;
    return {
      name: c.name, type: c.type, totalPaid: paid, totalUnpaid: unpaid,
      invoiceCount: c.invoices.length, overdueCount: overdue.length,
      creditLimit: c.creditLimit, creditUtilization: Math.round(creditUtil), recentOrders: recent,
    };
  }).sort((a, b) => b.totalPaid - a.totalPaid);

  // ── Financial totals ──
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const monthRevenue = invoices.filter(i => i.status === 'PAID' && new Date(i.invoiceDate) >= thirtyDaysAgo).reduce((s, i) => s + i.total, 0);
  const pendingValue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0);
  const overdueValue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // ── Expiry risk ──
  const expiryRisk = products.map(p => {
    const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
    const stockValue = p.price * p.currentStock;
    return { name: p.name, daysLeft, currentStock: p.currentStock, stockValue, minStock: p.minStock, reorderLevel: p.reorderLevel };
  }).filter(p => p.daysLeft <= 180).sort((a, b) => a.daysLeft - b.daysLeft);

  // ── Low stock ──
  const lowStock = products
    .filter(p => p.currentStock <= p.reorderLevel)
    .map(p => ({ name: p.name, currentStock: p.currentStock, minStock: p.minStock, reorderLevel: p.reorderLevel, price: p.price }))
    .sort((a, b) => a.currentStock - b.currentStock);

  // ── Inactive clients ──
  const inactiveClients = clients
    .filter(c => {
      if (c.invoices.length === 0) return true;
      const last = new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime())));
      return last < sixtyDaysAgo;
    })
    .map(c => ({ name: c.name, type: c.type, invoiceCount: c.invoices.length }));

  // ── Full data for AI ──
  const allProductDetails = products.map(p => ({
    name: p.name,
    genericName: p.genericName ?? 'N/A',
    type: p.type,
    category: p.category ?? 'N/A',
    batchNumber: p.batchNumber,
    unit: p.unit,
    manufacturer: p.manufacturer?.name ?? 'Unknown',
    manufacturerCompany: p.manufacturer?.motherCompany ?? 'N/A',
    currentStock: p.currentStock,
    initialStock: p.initialStock,
    minStock: p.minStock,
    reorderLevel: p.reorderLevel,
    price: p.price,
    expiryDate: new Date(p.expiryDate).toLocaleDateString('en-GB'),
    daysUntilExpiry: Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000),
    stockValue: p.price * p.currentStock,
    totalUnitsSold: p.invoiceItems.reduce((s, i) => s + i.quantity, 0),
    totalRevenue: p.invoiceItems.reduce((s, i) => s + i.totalPrice, 0),
    totalReturns: p.returns.length,
  }));

  const allClientDetails = clients.map(c => {
    const paid = c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    const unpaid = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((s, i) => s + i.total, 0);
    const overdue = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED' && new Date(i.dueDate) < now);
    const lastOrder = c.invoices.length > 0
      ? new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime()))).toLocaleDateString('en-GB')
      : 'Never';
    const productsBought = [...new Set(c.invoices.flatMap(i => i.items.map(item => item.product?.name)).filter(Boolean))];
    return {
      name: c.name, type: c.type,
      phone: c.phone ?? 'N/A', email: c.email ?? 'N/A',
      address: c.address ?? 'N/A', company: c.company ?? 'N/A',
      creditLimit: c.creditLimit ?? 0,
      totalPaid: paid, totalUnpaid: unpaid,
      invoiceCount: c.invoices.length, overdueCount: overdue.length,
      lastOrderDate: lastOrder,
      productsBought: productsBought.slice(0, 30),
      recentInvoices: c.invoices.slice(0, 5).map(i => ({
        number: i.invoiceNumber, status: i.status,
        total: i.total, date: new Date(i.invoiceDate).toLocaleDateString('en-GB'),
        dueDate: new Date(i.dueDate).toLocaleDateString('en-GB'),
        amountPaid: i.payments.reduce((s, p) => s + p.amount, 0),
      })),
    };
  });

  const allInvoiceDetails = invoices.slice(0, 150).map(inv => ({
    number: inv.invoiceNumber,
    client: inv.client?.name,
    clientType: inv.client?.type,
    clientPhone: inv.client?.phone ?? 'N/A',
    status: inv.status,
    subTotal: inv.subTotal,
    tax: inv.tax,
    total: inv.total,
    notes: inv.notes ?? '',
    hasReturns: inv.hasReturns,
    date: new Date(inv.invoiceDate).toLocaleDateString('en-GB'),
    dueDate: new Date(inv.dueDate).toLocaleDateString('en-GB'),
    amountPaid: inv.payments.reduce((s, p) => s + p.amount, 0),
    paymentMethods: [...new Set(inv.payments.map(p => p.method))].join(', '),
    items: inv.items.map(item => `${item.product?.name ?? 'Unknown'} x${item.quantity} @ K${item.unitPrice} = K${item.totalPrice}${item.freeSamples > 0 ? ` (+${item.freeSamples} free)` : ''}`),
  }));

  const allExpenses = expenses.map(e => ({
    description: e.description,
    category: e.category,
    amount: e.amount,
    date: new Date(e.date).toLocaleDateString('en-GB'),
  }));

  const allReturns = returns_.map(r => ({
    product: r.product?.name,
    productType: r.product?.type,
    quantity: r.quantity,
    reason: r.reason,
    invoice: r.invoice?.invoiceNumber,
    client: r.invoice?.client?.name ?? 'N/A',
    date: new Date(r.returnDate).toLocaleDateString('en-GB'),
  }));

  const manufacturerDetails = manufacturers.map(m => ({
    name: m.name,
    motherCompany: m.motherCompany ?? 'N/A',
    contactPerson: m.contactPerson ?? 'N/A',
    phone: m.phone ?? 'N/A',
    email: m.email ?? 'N/A',
    location: m.location ?? 'N/A',
    address: m.address ?? 'N/A',
    productCount: m.products.length,
    totalStockValue: m.products.reduce((s, p) => s + p.price * p.currentStock, 0),
    products: m.products.map(p => `${p.name} (${p.type}) - ${p.currentStock} units @ K${p.price}`),
  }));

  const systemSettings = Object.fromEntries(settings.map(s => [s.key, s.value]));

  const expensesByCategory = expenses.reduce((acc: Record<string, number>, e) => {
    acc[e.category] = (acc[e.category] ?? 0) + e.amount;
    return acc;
  }, {});

  return {
    summary: {
      totalRevenue, monthRevenue, pendingValue, overdueValue,
      totalExpenses, netProfit: totalRevenue - totalExpenses,
      profitMargin: totalRevenue > 0 ? ((totalRevenue - totalExpenses) / totalRevenue * 100).toFixed(1) + '%' : '0%',
      totalClients: clients.length, totalProducts: products.length,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter(i => i.status === 'PAID').length,
      pendingInvoices: invoices.filter(i => i.status === 'PENDING').length,
      overdueInvoices: invoices.filter(i => i.status === 'OVERDUE').length,
      cancelledInvoices: invoices.filter(i => i.status === 'CANCELLED').length,
      totalReturns: returns_.length,
      totalManufacturers: manufacturers.length,
      totalUsers: users.length,
      totalStockValue: products.reduce((s, p) => s + p.price * p.currentStock, 0),
    },
    topProducts,
    clientStats: clientStats.slice(0, 10),
    expiryRisk,
    lowStock,
    inactiveClients,
    recentExpenses: expenses.slice(0, 10).map(e => ({ description: e.description, amount: e.amount, category: e.category, date: e.date })),
    allProductDetails,
    allClientDetails,
    allInvoiceDetails,
    allExpenses,
    allReturns,
    manufacturerDetails,
    systemSettings,
    expensesByCategory,
    users: users.map(u => ({ name: u.name, email: u.email, role: u.role, isActive: u.isActive, lastLogin: u.lastLoginAt?.toLocaleDateString('en-GB') ?? 'Never' })),
  };
}

async function callGroqAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) throw new Error('GROQ_API_KEY not set in .env');

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
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

  const data = await response.json();
  return data.choices?.[0]?.message?.content ?? 'No response from AI';
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { type, query } = body;

    const data = await getBusinessSnapshot();

    const BASE_SYSTEM = `You are an AI business analyst embedded inside Glorious Pharma's management system.
You have access to real, live business data. Be specific, use actual numbers from the data provided.
Always respond in plain English — no markdown headers, no bullet symbols, write in clear paragraphs or short numbered lists.
Currency is ZMW (Zambian Kwacha). Today's date is ${new Date().toLocaleDateString('en-GB')}.
Be concise, practical, and direct. Speak like a trusted advisor, not a report generator.
Company settings: ${JSON.stringify(data.systemSettings)}`;

    const FULL_DATA_CONTEXT = `
=== FINANCIAL SUMMARY ===
Total revenue (all time): ZMW ${data.summary.totalRevenue.toFixed(2)}
Revenue this month: ZMW ${data.summary.monthRevenue.toFixed(2)}
Total expenses: ZMW ${data.summary.totalExpenses.toFixed(2)}
Net profit: ZMW ${data.summary.netProfit.toFixed(2)} (margin: ${data.summary.profitMargin})
Pending invoices: ZMW ${data.summary.pendingValue.toFixed(2)} (${data.summary.pendingInvoices} invoices)
Overdue invoices: ZMW ${data.summary.overdueValue.toFixed(2)} (${data.summary.overdueInvoices} invoices)
Cancelled invoices: ${data.summary.cancelledInvoices}
Total stock value: ZMW ${data.summary.totalStockValue.toFixed(2)}
Total returns: ${data.summary.totalReturns}

=== EXPENSES BY CATEGORY ===
${Object.entries(data.expensesByCategory).map(([cat, amt]) => `${cat}: ZMW ${(amt as number).toFixed(2)}`).join('\n')}

=== ALL PRODUCTS (${data.summary.totalProducts} total) ===
${data.allProductDetails.map(p => `${p.name} | Generic: ${p.genericName} | ${p.type} | Category: ${p.category} | Batch: ${p.batchNumber} | Mfr: ${p.manufacturer} (${p.manufacturerCompany}) | Stock: ${p.currentStock}/${p.initialStock} units | Min: ${p.minStock} | Reorder at: ${p.reorderLevel} | Price: K${p.price} | Unit: ${p.unit} | Expires: ${p.expiryDate} (${p.daysUntilExpiry} days) | Stock value: K${p.stockValue.toFixed(2)} | Units sold: ${p.totalUnitsSold} | Sales revenue: K${p.totalRevenue.toFixed(2)} | Returns: ${p.totalReturns}`).join('\n')}

=== ALL CLIENTS (${data.summary.totalClients} total) ===
${data.allClientDetails.map(c => `${c.name} | ${c.type} | Company: ${c.company} | Phone: ${c.phone} | Email: ${c.email} | Address: ${c.address} | Credit limit: K${c.creditLimit} | Total paid: K${c.totalPaid.toFixed(2)} | Outstanding: K${c.totalUnpaid.toFixed(2)} | Invoices: ${c.invoiceCount} | Overdue: ${c.overdueCount} | Last order: ${c.lastOrderDate} | Products bought: ${c.productsBought.join(', ')}`).join('\n')}

=== ALL MANUFACTURERS (${data.summary.totalManufacturers} total) ===
${data.manufacturerDetails.map(m => `${m.name} | Parent: ${m.motherCompany} | Contact: ${m.contactPerson} | Phone: ${m.phone} | Location: ${m.location} | Products: ${m.productCount} | Stock value: K${m.totalStockValue.toFixed(2)} | Products list: ${m.products.join('; ')}`).join('\n')}

=== LOW STOCK ALERTS ===
${data.lowStock.length === 0 ? 'None' : data.lowStock.map(p => `${p.name}: ${p.currentStock} units (reorder at ${p.reorderLevel}, min ${p.minStock}) @ K${p.price}`).join('\n')}

=== EXPIRY RISK (within 180 days) ===
${data.expiryRisk.length === 0 ? 'None' : data.expiryRisk.map(p => `${p.name}: ${p.daysLeft} days left, ${p.currentStock} units, K${p.stockValue.toFixed(2)} at risk`).join('\n')}

=== RECENT INVOICES (last 150) ===
${data.allInvoiceDetails.map(i => `${i.number} | ${i.client} (${i.clientType}) | ${i.status} | K${i.total.toFixed(2)} | Paid: K${i.amountPaid.toFixed(2)} | ${i.date} | Due: ${i.dueDate} | Payment: ${i.paymentMethods} | Items: ${i.items.join(', ')}`).join('\n')}

=== ALL EXPENSES ===
${data.allExpenses.map(e => `${e.date} | ${e.category} | ${e.description}: K${e.amount.toFixed(2)}`).join('\n')}

=== ALL RETURNS ===
${data.allReturns.length === 0 ? 'None' : data.allReturns.map(r => `${r.date} | ${r.product} (${r.productType}) x${r.quantity} | Reason: ${r.reason} | Client: ${r.client} | Invoice: ${r.invoice}`).join('\n')}

=== SYSTEM USERS ===
${data.users.map(u => `${u.name} | ${u.role} | ${u.email} | Active: ${u.isActive} | Last login: ${u.lastLogin}`).join('\n')}

=== INACTIVE CLIENTS (60+ days no orders) ===
${data.inactiveClients.length === 0 ? 'None' : data.inactiveClients.map(c => `${c.name} (${c.type}), ${c.invoiceCount} past invoices`).join('\n')}`;

    let aiResponse = '';

    if (type === 'insights') {
      aiResponse = await callGroqAI(BASE_SYSTEM, `Here is the full business snapshot for Glorious Pharma:
${FULL_DATA_CONTEXT}

Give 4 to 6 sharp, specific business insights and action recommendations based on this real data. Focus on the most important things that need attention right now. Be specific with names and numbers.`);
    }

    else if (type === 'inventory') {
      aiResponse = await callGroqAI(BASE_SYSTEM, `Analyse the inventory situation for Glorious Pharma:
${FULL_DATA_CONTEXT}

Give a clear inventory action plan. Which products need urgent restocking? Which near-expiry products should be discounted or prioritised for sale? What is the total value at risk from expiring stock?`);
    }

    else if (type === 'clients') {
      aiResponse = await callGroqAI(BASE_SYSTEM, `Analyse client risk and opportunities for Glorious Pharma:
${FULL_DATA_CONTEXT}

Provide: (1) which high-risk clients need immediate action and what action, (2) which inactive clients are worth re-engaging and how, (3) which top clients could be upsold or given loyalty benefits.`);
    }

    else if (type === 'financial') {
      aiResponse = await callGroqAI(BASE_SYSTEM, `Provide a full financial health analysis for Glorious Pharma:
${FULL_DATA_CONTEXT}

Analyse the financial health. Is the profit margin healthy? What is the overdue collection risk? Are there expense patterns worth noting? What should management focus on to improve profitability?`);
    }

    else if (type === 'chat' && query) {
      aiResponse = await callGroqAI(
        `${BASE_SYSTEM}

You have FULL access to all live Glorious Pharma business data:
${FULL_DATA_CONTEXT}

Answer the user question using this real data. Be specific with names and numbers. If asked about a specific product, client, invoice or manufacturer, find it in the data above and give exact details.`,
        query
      );
    }

    else {
      return NextResponse.json({ error: 'Invalid type. Use: insights, inventory, clients, financial, chat' }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      response: aiResponse,
      dataSnapshot: {
        totalRevenue: data.summary.totalRevenue,
        monthRevenue: data.summary.monthRevenue,
        pendingValue: data.summary.pendingValue,
        overdueValue: data.summary.overdueValue,
        netProfit: data.summary.netProfit,
        lowStockCount: data.lowStock.length,
        expiryRiskCount: data.expiryRisk.filter(p => p.daysLeft <= 30).length,
        topProducts: data.topProducts.slice(0, 5),
        clientStats: data.clientStats.slice(0, 5),
        lowStock: data.lowStock.slice(0, 5),
        expiryRisk: data.expiryRisk.slice(0, 5),
        inactiveClients: data.inactiveClients,
      },
    });

  } catch (error: any) {
    console.error('AI route error:', error);
    return NextResponse.json({ error: error.message ?? 'AI analysis failed' }, { status: 500 });
  }
}
