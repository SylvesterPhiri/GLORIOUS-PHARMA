// app/api/accounting/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
    return NextResponse.json({ expenses });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const { description, amount, category, date } = await request.json();

    if (!description || !amount) return NextResponse.json({ error: 'Description and amount required' }, { status: 400 });

    const expense = await prisma.expense.create({
      data: { description, amount: parseFloat(amount), category: category ?? 'Operations', date: date ? new Date(date) : new Date() },
    });

    await logAudit({
      action: 'EXPENSE_CREATED', entityType: 'EXPENSE', entityId: expense.id,
      userId: session?.id,
      description: `Expense recorded: "${description}" — K${parseFloat(amount).toFixed(2)} (${category ?? 'Operations'}) by ${session?.name ?? 'unknown'}`,
      newData: { description, amount: expense.amount, category: expense.category, date: expense.date },
    });

    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
