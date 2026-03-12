
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(_request: NextRequest) {
  try {
    const now        = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const [allInvoices, expenses, returns] = await Promise.all([
      prisma.invoice.findMany({
        where:   { isHistorical: false },
        include: { payments: true, items: true },
      }),
      prisma.expense.findMany({ orderBy: { date: 'desc' } }),
      prisma.return.findMany({ include: { invoice: { include: { items: true } } } }),
    ]);

    const paid    = allInvoices.filter((i) => i.status === 'PAID');
    const pending = allInvoices.filter((i) => i.status === 'PENDING' || i.status === 'OVERDUE');

    const totalRevenue   = paid.reduce((s, i) => s + i.total, 0);
    const monthlyRevenue = paid
      .filter((i) => new Date(i.invoiceDate) >= monthStart)
      .reduce((s, i) => s + i.total, 0);
    const pendingRevenue = pending.reduce((s, i) => s + i.total, 0);

    const totalRefunds = returns.reduce((sum, r) => {
      const items = r.invoice?.items ?? [];
      const item  = items.find((it: any) => it.productId === r.productId);
      return sum + r.quantity * (item?.unitPrice ?? 0);
    }, 0);

    const totalExpenses = expenses.reduce((s, e) => s + e.amount, 0);
    const netRevenue    = totalRevenue - totalRefunds;
    const netProfit     = netRevenue - totalExpenses;

    return NextResponse.json({
      success: true,
      data: {
        totalRevenue, monthlyRevenue, pendingRevenue,
        totalInvoices: allInvoices.length, paidInvoices: paid.length, unpaidInvoices: pending.length,
        totalRefunds, netRevenue, totalExpenses, netProfit, expenses,
      },
    });
  } catch (error: any) {
    console.error('Accounting API error:', error);
    return NextResponse.json({ error: 'Failed to fetch accounting data', details: error.message }, { status: 500 });
  }
}
