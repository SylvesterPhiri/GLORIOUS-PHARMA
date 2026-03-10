// app/api/ai/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

// ── Fetch all real business data from the DB ──────────────────────────────────
async function getBusinessSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [products, clients, invoices, expenses, returns_] = await Promise.all([
    prisma.product.findMany({
      include: {
        manufacturer: { select: { name: true } },
        invoiceItems: { select: { quantity: true, totalPrice: true, invoice: { select: { invoiceDate: true, status: true } } } },
      },
    }),
    prisma.client.findMany({
      include: {
        invoices: {
          select: {
            id: true, invoiceNumber: true, status: true,
            total: true, dueDate: true, invoiceDate: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { isHistorical: false },
      include: {
        client: { select: { name: true, type: true } },
        items: {
          include: {
            product: { select: { name: true, type: true, category: true } },
          },
        },
        payments: { select: { amount: true, method: true, paymentDate: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
    prisma.return.findMany({
      include: {
        product: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
  ]);

  // ── Derive key metrics ──────────────────────────────────────────────────────

  // Product sales volumes (from invoice items on PAID/PENDING invoices)
  const productSales: Record<string, { name: string; unitsSold: number; revenue: number; recentUnits: number }> = {};
  for (const inv of invoices) {
    for (const item of inv.items) {
      const name = item.product?.name ?? 'Unknown';
      if (!productSales[name]) productSales[name] = { name, unitsSold: 0, revenue: 0, recentUnits: 0 };
      productSales[name].unitsSold += item.quantity;
      productSales[name].revenue += item.totalPrice;
      if (new Date(inv.invoiceDate) >= thirtyDaysAgo) {
        productSales[name].recentUnits += item.quantity;
      }
    }
  }
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Client stats
  const clientStats = clients.map(c => {
    const paid = c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    const unpaid = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((s, i) => s + i.total, 0);
    const overdue = c.invoices.filter(i => i.status !== 'PAID' && new Date(i.dueDate) < now);
    const recent = c.invoices.filter(i => new Date(i.invoiceDate) >= thirtyDaysAgo).length;
    const creditUtil = c.creditLimit ? (unpaid / c.creditLimit) * 100 : 0;
    return {
      name: c.name, type: c.type, totalPaid: paid, totalUnpaid: unpaid,
      invoiceCount: c.invoices.length, overdueCount: overdue.length,
      creditLimit: c.creditLimit, creditUtilization: Math.round(creditUtil),
      recentOrders: recent,
    };
  }).sort((a, b) => b.totalPaid - a.totalPaid);

  // Revenue
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const monthRevenue = invoices.filter(i => i.status === 'PAID' && new Date(i.invoiceDate) >= thirtyDaysAgo).reduce((s, i) => s + i.total, 0);
  const pendingValue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0);
  const overdueValue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Expiry risk
  const expiryRisk = products.map(p => {
    const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
    const stockValue = p.price * p.currentStock;
    return { name: p.name, daysLeft, currentStock: p.currentStock, stockValue, minStock: p.minStock, reorderLevel: p.reorderLevel };
  }).filter(p => p.daysLeft <= 180).sort((a, b) => a.daysLeft - b.daysLeft);

  // Low stock
  const lowStock = products
    .filter(p => p.currentStock <= p.reorderLevel)
    .map(p => ({ name: p.name, currentStock: p.currentStock, minStock: p.minStock, reorderLevel: p.reorderLevel, price: p.price }))
    .sort((a, b) => a.currentStock - b.currentStock);

  // Inactive clients (no orders in 60+ days)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const inactiveClients = clients
    .filter(c => {
      if (c.invoices.length === 0) return true;
      const last = new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime())));
      return last < sixtyDaysAgo;
    })
    .map(c => ({ name: c.name, type: c.type, invoiceCount: c.invoices.length }));

  return {
    summary: {
      totalRevenue, monthRevenue, pendingValue, overdueValue,
      totalExpenses, netProfit: totalRevenue - totalExpenses,
      totalClients: clients.length, totalProducts: products.length,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter(i => i.status === 'PAID').length,
      pendingInvoices: invoices.filter(i => i.status === 'PENDING').length,
      overdueInvoices: invoices.filter(i => i.status === 'OVERDUE').length,
      totalReturns: returns_.length,
    },
    topProducts,
    clientStats: clientStats.slice(0, 10),
    expiryRisk,
    lowStock,
    inactiveClients,
    recentExpenses: expenses.slice(0, 10).map(e => ({ description: e.description, amount: e.amount, category: e.category, date: e.date })),
  };
}

// ── Call Groq AI ─────────────────────────────────────────────────────────────
async function callCloudflareAI(systemPrompt: string, userMessage: string): Promise<string> {
  if (!process.env.GROQ_API_KEY) {
    throw new Error('GROQ_API_KEY not set in .env');
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      max_tokens: 1000,
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

// ── Main POST handler
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

// ── Fetch all real business data from the DB ──────────────────────────────────
async function getBusinessSnapshot() {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);

  const [products, clients, invoices, expenses, returns_] = await Promise.all([
    prisma.product.findMany({
      include: {
        manufacturer: { select: { name: true } },
        invoiceItems: { select: { quantity: true, totalPrice: true, invoice: { select: { invoiceDate: true, status: true } } } },
      },
    }),
    prisma.client.findMany({
      include: {
        invoices: {
          select: {
            id: true, invoiceNumber: true, status: true,
            total: true, dueDate: true, invoiceDate: true,
          },
        },
      },
    }),
    prisma.invoice.findMany({
      where: { isHistorical: false },
      include: {
        client: { select: { name: true, type: true } },
        items: {
          include: {
            product: { select: { name: true, type: true, category: true } },
          },
        },
        payments: { select: { amount: true, method: true, paymentDate: true } },
      },
      orderBy: { invoiceDate: 'desc' },
    }),
    prisma.expense.findMany({ orderBy: { date: 'desc' } }),
    prisma.return.findMany({
      include: {
        product: { select: { name: true } },
        invoice: { select: { invoiceNumber: true } },
      },
    }),
  ]);

  // ── Derive key metrics ──────────────────────────────────────────────────────

  // Product sales volumes (from invoice items on PAID/PENDING invoices)
  const productSales: Record<string, { name: string; unitsSold: number; revenue: number; recentUnits: number }> = {};
  for (const inv of invoices) {
    for (const item of inv.items) {
      const name = item.product?.name ?? 'Unknown';
      if (!productSales[name]) productSales[name] = { name, unitsSold: 0, revenue: 0, recentUnits: 0 };
      productSales[name].unitsSold += item.quantity;
      productSales[name].revenue += item.totalPrice;
      if (new Date(inv.invoiceDate) >= thirtyDaysAgo) {
        productSales[name].recentUnits += item.quantity;
      }
    }
  }
  const topProducts = Object.values(productSales)
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 10);

  // Client stats
  const clientStats = clients.map(c => {
    const paid = c.invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
    const unpaid = c.invoices.filter(i => i.status !== 'PAID' && i.status !== 'CANCELLED').reduce((s, i) => s + i.total, 0);
    const overdue = c.invoices.filter(i => i.status !== 'PAID' && new Date(i.dueDate) < now);
    const recent = c.invoices.filter(i => new Date(i.invoiceDate) >= thirtyDaysAgo).length;
    const creditUtil = c.creditLimit ? (unpaid / c.creditLimit) * 100 : 0;
    return {
      name: c.name, type: c.type, totalPaid: paid, totalUnpaid: unpaid,
      invoiceCount: c.invoices.length, overdueCount: overdue.length,
      creditLimit: c.creditLimit, creditUtilization: Math.round(creditUtil),
      recentOrders: recent,
    };
  }).sort((a, b) => b.totalPaid - a.totalPaid);

  // Revenue
  const totalRevenue = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + i.total, 0);
  const monthRevenue = invoices.filter(i => i.status === 'PAID' && new Date(i.invoiceDate) >= thirtyDaysAgo).reduce((s, i) => s + i.total, 0);
  const pendingValue = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + i.total, 0);
  const overdueValue = invoices.filter(i => i.status === 'OVERDUE').reduce((s, i) => s + i.total, 0);
  const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);

  // Expiry risk
  const expiryRisk = products.map(p => {
    const daysLeft = Math.ceil((new Date(p.expiryDate).getTime() - now.getTime()) / 86400000);
    const stockValue = p.price * p.currentStock;
    return { name: p.name, daysLeft, currentStock: p.currentStock, stockValue, minStock: p.minStock, reorderLevel: p.reorderLevel };
  }).filter(p => p.daysLeft <= 180).sort((a, b) => a.daysLeft - b.daysLeft);

  // Low stock
  const lowStock = products
    .filter(p => p.currentStock <= p.reorderLevel)
    .map(p => ({ name: p.name, currentStock: p.currentStock, minStock: p.minStock, reorderLevel: p.reorderLevel, price: p.price }))
    .sort((a, b) => a.currentStock - b.currentStock);

  // Inactive clients (no orders in 60+ days)
  const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);
  const inactiveClients = clients
    .filter(c => {
      if (c.invoices.length === 0) return true;
      const last = new Date(Math.max(...c.invoices.map(i => new Date(i.invoiceDate).getTime())));
      return last < sixtyDaysAgo;
    })
    .map(c => ({ name: c.name, type: c.type, invoiceCount: c.invoices.length }));

  return {
    summary: {
      totalRevenue, monthRevenue, pendingValue, overdueValue,
      totalExpenses, netProfit: totalRevenue - totalExpenses,
      totalClients: clients.length, totalProducts: products.length,
      totalInvoices: invoices.length,
      paidInvoices: invoices.filter(i => i.status === 'PAID').length,
      pendingInvoices: invoices.filter(i => i.status === 'PENDING').length,
      overdueInvoices: invoices.filter(i => i.status === 'OVERDUE').length,
      totalReturns: returns_.length,
    },
    topProducts,
    clientStats: clientStats.slice(0, 10),
    expiryRisk,
    lowStock,
    inactiveClients,
    recentExpenses: expenses.slice(0, 10).map(e => ({ description: e.description, amount: e.amount, category: e.category, date: e.date })),
  };
}

// ── Call Groq AI ─────────────────────────────────────────────────────────────

// ── Route handler ─────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  console.log('\n=== 🤖 AI API CALLED ===');
  console.log('📝 Request time:', new Date().toISOString());
  
  try {
    const session = await getSession();
    console.log('👤 Session user:', session?.id ? 'Authenticated' : 'Not authenticated');
    
    if (!session) {
      console.log('❌ No session - unauthorized');
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { type, query } = await request.json();
    console.log('📊 Request type:', type);
    console.log('💬 Query:', query || 'N/A');

    // Using Groq AI

    console.log('📊 Fetching business snapshot...');
    const data = await getBusinessSnapshot();
    console.log('✅ Business snapshot fetched successfully');

    const BASE_SYSTEM = `You are an AI business analyst embedded inside Glorious Pharma's management system.
You have access to real, live business data. Be specific, use actual numbers from the data provided.
Always respond in plain English — no markdown headers, no bullet symbols, write in clear paragraphs or short numbered lists.
Currency is ZMW (Zambian Kwacha). Today's date is ${new Date().toLocaleDateString('en-GB')}.
Be concise, practical, and direct. Speak like a trusted advisor, not a report generator.`;

    let aiResponse = '';

    // ── 1. Dashboard insights ─────────────────────────────────────────────────
    if (type === 'insights') {
      console.log('📊 Generating insights...');
      aiResponse = await callCloudflareAI(BASE_SYSTEM, `
Here is the current business snapshot for Glorious Pharma:

FINANCIAL SUMMARY:
- Total revenue (all time): ZMW ${data.summary.totalRevenue.toFixed(2)}
- Revenue this month: ZMW ${data.summary.monthRevenue.toFixed(2)}
- Pending invoices value: ZMW ${data.summary.pendingValue.toFixed(2)}
- Overdue invoices value: ZMW ${data.summary.overdueValue.toFixed(2)}
- Total expenses: ZMW ${data.summary.totalExpenses.toFixed(2)}
- Net profit: ZMW ${data.summary.netProfit.toFixed(2)}
- Invoices: ${data.summary.paidInvoices} paid, ${data.summary.pendingInvoices} pending, ${data.summary.overdueInvoices} overdue

TOP SELLING PRODUCTS (by revenue):
${data.topProducts.map((p, i) => `${i + 1}. ${p.name} — ${p.unitsSold} units sold, ZMW ${p.revenue.toFixed(2)} revenue, ${p.recentUnits} units in last 30 days`).join('\n')}

EXPIRY RISK (products expiring within 180 days):
${data.expiryRisk.length === 0 ? 'None' : data.expiryRisk.slice(0, 5).map(p => `- ${p.name}: ${p.daysLeft} days left, ${p.currentStock} units in stock (ZMW ${p.stockValue.toFixed(2)} at risk)`).join('\n')}

LOW STOCK ALERTS:
${data.lowStock.length === 0 ? 'None' : data.lowStock.map(p => `- ${p.name}: ${p.currentStock} units (reorder level: ${p.reorderLevel})`).join('\n')}

TOP CLIENTS:
${data.clientStats.slice(0, 5).map((c, i) => `${i + 1}. ${c.name} (${c.type}): ZMW ${c.totalPaid.toFixed(2)} paid, ZMW ${c.totalUnpaid.toFixed(2)} outstanding, ${c.overdueCount} overdue`).join('\n')}

INACTIVE CLIENTS (no orders in 60+ days): ${data.inactiveClients.map(c => c.name).join(', ') || 'None'}

Give me 4 to 6 sharp, specific business insights and action recommendations based on this real data. 
Focus on the most important things that need attention right now. Be specific with numbers.`);
    }

    // ── 2. Inventory analysis ─────────────────────────────────────────────────
    else if (type === 'inventory') {
      console.log('📊 Generating inventory analysis...');
      aiResponse = await callCloudflareAI(BASE_SYSTEM, `
Analyse the inventory situation for Glorious Pharma:

LOW STOCK (at or below reorder level):
${data.lowStock.length === 0 ? 'No products are low on stock.' : data.lowStock.map(p => `- ${p.name}: ${p.currentStock} units left (min: ${p.minStock}, reorder at: ${p.reorderLevel})`).join('\n')}

EXPIRY RISK:
${data.expiryRisk.length === 0 ? 'No products expiring within 6 months.' : data.expiryRisk.map(p => `- ${p.name}: expires in ${p.daysLeft} days, ${p.currentStock} units in stock worth ZMW ${p.stockValue.toFixed(2)}`).join('\n')}

TOP SELLING PRODUCTS (use to cross-reference stock urgency):
${data.topProducts.slice(0, 5).map(p => `- ${p.name}: ${p.recentUnits} units sold in last 30 days`).join('\n')}

Give a clear inventory action plan. Which products need urgent restocking? Which near-expiry products should be discounted or prioritised for sale? What is the total value at risk from expiring stock?`);
    }

    // ── 3. Client risk analysis ───────────────────────────────────────────────
    else if (type === 'clients') {
      console.log('📊 Generating client analysis...');
      const highRisk = data.clientStats.filter(c => c.creditUtilization > 80 || c.overdueCount > 0);
      const mediumRisk = data.clientStats.filter(c => c.creditUtilization > 50 && c.creditUtilization <= 80);

      aiResponse = await callCloudflareAI(BASE_SYSTEM, `
Analyse client risk and opportunities for Glorious Pharma:

HIGH RISK CLIENTS (overdue payments or high credit utilization):
${highRisk.length === 0 ? 'None' : highRisk.map(c => `- ${c.name} (${c.type}): ZMW ${c.totalUnpaid.toFixed(2)} outstanding, ${c.overdueCount} overdue invoices, credit utilization ${c.creditUtilization}%`).join('\n')}

MEDIUM RISK CLIENTS:
${mediumRisk.length === 0 ? 'None' : mediumRisk.map(c => `- ${c.name}: ZMW ${c.totalUnpaid.toFixed(2)} outstanding, ${c.creditUtilization}% credit used`).join('\n')}

TOP PERFORMING CLIENTS:
${data.clientStats.slice(0, 5).map(c => `- ${c.name}: ZMW ${c.totalPaid.toFixed(2)} total paid, ${c.invoiceCount} invoices, ${c.recentOrders} orders this month`).join('\n')}

INACTIVE CLIENTS (60+ days no orders):
${data.inactiveClients.length === 0 ? 'None' : data.inactiveClients.map(c => `- ${c.name} (${c.type}), ${c.invoiceCount} total past invoices`).join('\n')}

Provide: (1) which high-risk clients need immediate action and what action, (2) which inactive clients are worth re-engaging and how, (3) which top clients could be upsold or given loyalty benefits.`);
    }

    // ── 4. Financial analysis ─────────────────────────────────────────────────
    else if (type === 'financial') {
      console.log('📊 Generating financial analysis...');
      aiResponse = await callCloudflareAI(BASE_SYSTEM, `
Provide a financial health analysis for Glorious Pharma:

REVENUE & PROFIT:
- Total all-time revenue: ZMW ${data.summary.totalRevenue.toFixed(2)}
- Revenue this month: ZMW ${data.summary.monthRevenue.toFixed(2)}
- Total expenses: ZMW ${data.summary.totalExpenses.toFixed(2)}
- Net profit: ZMW ${data.summary.netProfit.toFixed(2)}
- Profit margin: ${data.summary.totalRevenue > 0 ? ((data.summary.netProfit / data.summary.totalRevenue) * 100).toFixed(1) : 0}%

CASH FLOW RISK:
- Pending (not yet due): ZMW ${data.summary.pendingValue.toFixed(2)}
- Overdue (past due date): ZMW ${data.summary.overdueValue.toFixed(2)}
- Total ${data.summary.overdueInvoices} overdue invoices

RECENT EXPENSES:
${data.recentExpenses.slice(0, 8).map(e => `- ${e.description} (${e.category}): ZMW ${e.amount.toFixed(2)}`).join('\n')}

Analyse the financial health. Is the profit margin healthy for a pharmaceutical distributor? What is the overdue collection risk? Are there expense patterns worth noting? What should management focus on to improve profitability?`);
    }

    // ── 5. Natural language chat ──────────────────────────────────────────────
    else if (type === 'chat' && query) {
      console.log('💬 Processing chat query...');
      aiResponse = await callCloudflareAI(
        `${BASE_SYSTEM}

You have access to this live business data:
- Revenue this month: ZMW ${data.summary.monthRevenue.toFixed(2)}
- Total revenue: ZMW ${data.summary.totalRevenue.toFixed(2)}  
- Net profit: ZMW ${data.summary.netProfit.toFixed(2)}
- Pending: ZMW ${data.summary.pendingValue.toFixed(2)} across ${data.summary.pendingInvoices} invoices
- Overdue: ZMW ${data.summary.overdueValue.toFixed(2)} across ${data.summary.overdueInvoices} invoices
- Total clients: ${data.summary.totalClients}
- Total products: ${data.summary.totalProducts}
- Low stock items: ${data.lowStock.length} products
- Near-expiry items: ${data.expiryRisk.filter(p => p.daysLeft <= 30).length} products expiring within 30 days
- Top client: ${data.clientStats[0]?.name ?? 'N/A'} (ZMW ${data.clientStats[0]?.totalPaid.toFixed(2) ?? 0} paid)
- Top product: ${data.topProducts[0]?.name ?? 'N/A'} (${data.topProducts[0]?.unitsSold ?? 0} units sold)

Full product list: ${data.topProducts.map(p => p.name).join(', ')}
Full client list: ${data.clientStats.map(c => c.name).join(', ')}

Answer the user's question using this real data. If you don't have enough detail, say so clearly.`,
        query
      );
    }

    else {
      console.log('❌ Invalid type:', type);
      return NextResponse.json({ error: 'Invalid type. Use: insights, inventory, clients, financial, chat' }, { status: 400 });
    }

    console.log('✅ AI response generated successfully');
    
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
    console.error('❌ AI route error:', error);
    return NextResponse.json({ error: error.message ?? 'AI analysis failed' }, { status: 500 });
  }
}