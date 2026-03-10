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
