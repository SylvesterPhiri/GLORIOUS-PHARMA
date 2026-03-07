// app/api/accounting/expenses/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; oldData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, oldData: data.oldData ? JSON.stringify(data.oldData) : null } }); } catch {}
}

export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session  = await getSession();
    const existing = await prisma.expense.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Expense not found' }, { status: 404 });

    await prisma.expense.delete({ where: { id: params.id } });

    await logAudit({
      action: 'EXPENSE_DELETED', entityType: 'EXPENSE', entityId: params.id,
      userId: session?.id,
      description: `Expense deleted: "${existing.description}" — K${existing.amount.toFixed(2)} by ${session?.name ?? 'unknown'}`,
      oldData: { description: existing.description, amount: existing.amount, category: existing.category },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete expense' }, { status: 500 });
  }
}
