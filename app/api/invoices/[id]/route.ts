// app/api/invoices/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

interface RouteParams { params: { id: string } }

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action, entityType: data.entityType, entityId: data.entityId ?? null,
        userId: data.userId ?? null, description: data.description ?? null,
        newData: data.newData ? JSON.stringify(data.newData) : null,
      },
    });
  } catch {}
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = params;
    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: { select: { id: true, name: true, email: true, phone: true, address: true } },
        items: {
          include: {
            product: { select: { id: true, name: true, genericName: true, type: true, unit: true } },
          },
        },
        payments: true,
        returns: { include: { product: { select: { id: true, name: true } } } },
      },
    });

    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const response = NextResponse.json(invoice);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch invoice', details: error.message }, { status: 500 });
  }
}

// PATCH — mark as paid / update status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id }  = params;
    const body    = await request.json();

    const invoice = await prisma.invoice.findUnique({ where: { id } });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    const { action } = body;

    if (action === 'mark_paid') {
      const { amount, method, paymentDate, chequeNumber, bankName, notes } = body;

      const updated = await prisma.$transaction(async (tx) => {
        // Create payment record
        await tx.payment.create({
          data: {
            invoiceId:    id,
            amount:       parseFloat(amount) || invoice.total,
            method:       method   || 'CASH',
            chequeNumber: chequeNumber || null,
            bankName:     bankName     || null,
            paymentDate:  paymentDate ? new Date(paymentDate) : new Date(),
            notes:        notes || null,
          },
        });

        // Update invoice status to PAID
        return tx.invoice.update({
          where: { id },
          data:  { status: 'PAID' },
          include: { client: true, payments: true },
        });
      });

      await logAudit({
        action:      'INVOICE_PAID',
        entityType:  'INVOICE',
        entityId:    id,
        userId:      session?.id,
        description: `Invoice ${invoice.invoiceNumber} marked as paid — K${(parseFloat(amount) || invoice.total).toFixed(2)} via ${method || 'CASH'}`,
        newData:     { status: 'PAID', amount, method },
      });

      return NextResponse.json({ success: true, invoice: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: any) {
    console.error('PATCH invoice error:', error);
    return NextResponse.json({ error: 'Failed to update invoice', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id }  = params;

    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: true, returns: true },
    });

    if (!existingInvoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    if (existingInvoice.returns?.length > 0) {
      return NextResponse.json({ error: 'Cannot delete invoice with returns. Delete returns first.' }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.payment.deleteMany({ where: { invoiceId: id } });
      await tx.invoiceItem.deleteMany({ where: { invoiceId: id } });
      await tx.invoice.delete({ where: { id } });
    });

    await logAudit({
      action: 'INVOICE_DELETED', entityType: 'INVOICE', entityId: id,
      userId: session?.id,
      description: `Invoice ${existingInvoice.invoiceNumber} deleted`,
    });

    const response = NextResponse.json({ success: true, message: 'Invoice deleted successfully' });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete invoice', details: error.message }, { status: 500 });
  }
}
