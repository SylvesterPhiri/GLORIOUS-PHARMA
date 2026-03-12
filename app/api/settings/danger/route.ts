
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only SUPER_ADMIN can perform this action' }, { status: 403 });
    }

    const { action } = await request.json();

    if (action === 'clear_audit_logs') {
      const { count } = await prisma.auditLog.deleteMany({});
      return NextResponse.json({ success: true, message: `Deleted ${count} audit log entries` });
    }

    if (action === 'reset_data') {

      await prisma.auditLog.deleteMany({});
      await prisma.return.deleteMany({});
      await prisma.payment.deleteMany({});
      await prisma.invoiceItem.deleteMany({});
      await prisma.invoice.deleteMany({});
      await prisma.expense.deleteMany({});
      await prisma.product.deleteMany({});
      await prisma.client.deleteMany({});
      await prisma.manufacturer.deleteMany({});
      return NextResponse.json({ success: true, message: 'All data cleared. Users and settings preserved.' });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('Danger zone error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
