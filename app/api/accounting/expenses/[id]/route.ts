
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: {
  action: string; entityType: string; entityId?: string;
  userId?: string; description?: string; oldData?: any; newData?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action:     data.action,
        entityType: data.entityType,
        entityId:   data.entityId   ?? null,
        userId:     data.userId     ?? null,
        description: data.description ?? null,
        oldData:    data.oldData ? JSON.stringify(data.oldData) : null,
        newData:    data.newData ? JSON.stringify(data.newData) : null,
      },
    });
  } catch {}
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session  = await getSession();
    const existing = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    const { description, amount, category, date } = await request.json();
    if (!description || !amount)
      return NextResponse.json({ error: 'Description and amount required' }, { status: 400 });

    const updated = await prisma.expense.update({
      where: { id: params.id },
      data: {
        description,
        amount:   parseFloat(amount),
        category: category ?? existing.category,
        date:     date ? new Date(date) : existing.date,
      },
    });

    await logAudit({
      action:      'EXPENSE_UPDATED',
      entityType:  'EXPENSE',
      entityId:    params.id,
      userId:      session?.id,
      description: `Expense updated: "${description}" — K${parseFloat(amount).toFixed(2)} by ${session?.name ?? 'unknown'}`,
      oldData:     { description: existing.description, amount: existing.amount, category: existing.category },
      newData:     { description, amount: updated.amount, category: updated.category, date: updated.date },
    });

    return NextResponse.json({ success: true, expense: updated });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to update expense' }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session  = await getSession();
    const existing = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    await prisma.expense.delete({ where: { id: params.id } });

    await logAudit({
      action:      'EXPENSE_DELETED',
      entityType:  'EXPENSE',
      entityId:    params.id,
      userId:      session?.id,
      description: `Expense deleted: "${existing.description}" — K${existing.amount.toFixed(2)} by ${session?.name ?? 'unknown'}`,
      oldData:     { description: existing.description, amount: existing.amount, category: existing.category },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}