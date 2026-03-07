// app/api/invoices/[id]/return/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

interface ReturnItem { productId: string; quantity: number; reason?: string; }

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const { id }  = params;
    const body    = await request.json();
    const { items }: { items: ReturnItem[] } = body;

    if (!items?.length) return NextResponse.json({ error: 'No items provided for return' }, { status: 400 });

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { items: { include: { product: true } }, client: true },
    });
    if (!invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    for (const returnItem of items) {
      const invoiceItem = invoice.items.find((i) => i.productId === returnItem.productId);
      if (!invoiceItem) return NextResponse.json({ error: `Product ${returnItem.productId} not found in invoice` }, { status: 400 });
      if (returnItem.quantity > invoiceItem.quantity) return NextResponse.json({ error: `Cannot return more than ${invoiceItem.quantity} units of ${invoiceItem.product?.name}` }, { status: 400 });
      if (returnItem.quantity <= 0) return NextResponse.json({ error: 'Return quantity must be greater than 0' }, { status: 400 });
    }

    const result = await prisma.$transaction(async (tx) => {
      const returns = [];
      for (const returnItem of items) {
        const ret = await tx.return.create({
          data: { invoiceId: id, productId: returnItem.productId, quantity: returnItem.quantity, reason: returnItem.reason || 'No reason provided' },
        });
        await tx.product.update({ where: { id: returnItem.productId }, data: { currentStock: { increment: returnItem.quantity } } });
        returns.push(ret);
      }

      const returnAmount = items.reduce((sum, item) => {
        const invoiceItem = invoice.items.find((i) => i.productId === item.productId);
        return sum + (invoiceItem?.unitPrice || 0) * item.quantity;
      }, 0);

      const newTotal = Math.max(invoice.total - returnAmount, 0);
      await tx.invoice.update({ where: { id }, data: { total: newTotal, hasReturns: true } });

      return { returns, returnAmount, newTotal };
    });

    const returnedProductNames = items.map((item) => {
      const inv = invoice.items.find((i) => i.productId === item.productId);
      return `${inv?.product?.name ?? item.productId} x${item.quantity}`;
    }).join(', ');

    await logAudit({
      action: 'RETURN_PROCESSED', entityType: 'RETURN', entityId: id,
      userId: session?.id,
      description: `Return processed for invoice ${invoice.invoiceNumber} (${invoice.client.name}): ${returnedProductNames}. Refund: K${result.returnAmount.toFixed(2)}`,
      newData: { invoiceId: id, items, returnAmount: result.returnAmount, newInvoiceTotal: result.newTotal },
    });

    return NextResponse.json({ success: true, message: 'Return processed successfully', returns: result.returns, returnAmount: result.returnAmount, newInvoiceTotal: result.newTotal });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to process return', details: error.message }, { status: 500 });
  }
}
