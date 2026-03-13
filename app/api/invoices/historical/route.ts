
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { InvoiceStatus } from '@prisma/client';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

interface HistoricalItemInput {
  productId?: string; productName: string; productSku?: string;
  quantity: number; unitPrice: number; freeSamples?: number;
}

function resolveStatus(status?: string): InvoiceStatus {
  const map: Record<string, InvoiceStatus> = {
    PAID: InvoiceStatus.PAID, PENDING: InvoiceStatus.PENDING, UNPAID: InvoiceStatus.PENDING,
    OVERDUE: InvoiceStatus.OVERDUE, DRAFT: InvoiceStatus.DRAFT, CANCELLED: InvoiceStatus.CANCELLED,
  };
  return map[status?.toUpperCase() ?? ''] ?? InvoiceStatus.PAID;
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const page  = parseInt(searchParams.get('page')  || '1');
    const limit = parseInt(searchParams.get('limit') || '50');
    const skip  = (page - 1) * limit;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where: { isHistorical: true },
        include: {
          client:   { select: { id: true, name: true, email: true, phone: true } },
          items:    { include: { product: { select: { name: true, price: true } } } },
          payments: true,
        },
        orderBy: { invoiceDate: 'desc' },
        skip, take: limit,
      }),
      prisma.invoice.count({ where: { isHistorical: true } }),
    ]);

    return NextResponse.json({ invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch historical invoices', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.clientId)      return NextResponse.json({ error: 'Client is required' }, { status: 400 });
    if (!data.invoiceDate)   return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 });
    if (!data.dueDate)       return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
    if (!data.items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

    for (const item of data.items as HistoricalItemInput[]) {
      if (!item.productName?.trim()) return NextResponse.json({ error: 'Every item must have a product name' }, { status: 400 });
      if (!item.quantity || item.quantity < 1) return NextResponse.json({ error: `Quantity must be at least 1 for: ${item.productName}` }, { status: 400 });
      if (item.unitPrice === undefined || item.unitPrice < 0) return NextResponse.json({ error: `Invalid unit price for: ${item.productName}` }, { status: 400 });
    }

    const client = await prisma.client.findUnique({ where: { id: data.clientId }, select: { id: true, name: true } });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const invoiceNumber: string = data.invoiceNumber?.trim() || `HIST-${Date.now()}`;
    let subTotal = 0;

    interface PreparedItem { productId: string | null; productSnapshot: string; quantity: number; freeSamples: number; unitPrice: number; totalPrice: number; }
    const preparedItems: PreparedItem[] = [];

    for (const item of data.items as HistoricalItemInput[]) {
      const quantity    = parseInt(String(item.quantity));
      const freeSamples = parseInt(String(item.freeSamples ?? 0)) || 0;
      const unitPrice   = parseFloat(String(item.unitPrice));
      const totalPrice  = quantity * unitPrice; // full quantity billed (historical)
      subTotal += totalPrice;

      let resolvedProductId: string | null = null;
      if (item.productId) {
        const exists = await prisma.product.findUnique({ where: { id: item.productId }, select: { id: true } });
        if (exists) resolvedProductId = exists.id;
      }

      preparedItems.push({
        productId: resolvedProductId,
        productSnapshot: JSON.stringify({ name: item.productName.trim(), sku: item.productSku?.trim() ?? null }),
        quantity, freeSamples, unitPrice, totalPrice,
      });
    }

    const tax   = parseFloat(data.tax) || 0;
    const total = subTotal + tax;

    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber, clientId: data.clientId,
          invoiceDate: new Date(data.invoiceDate), dueDate: new Date(data.dueDate),
          status: resolveStatus(data.status), subTotal, tax, total,
          notes: data.notes || null, isHistorical: true, affectsInventory: false,
          historicalNote: data.historicalNote || null,
        },
      });
      for (const item of preparedItems) {
        await tx.invoiceItem.create({ data: { invoiceId: newInvoice.id, productId: item.productId, productSnapshot: item.productSnapshot, quantity: item.quantity, freeSamples: item.freeSamples, unitPrice: item.unitPrice, totalPrice: item.totalPrice } });
      }
      if (data.payment?.amount > 0) {
        await tx.payment.create({ data: { invoiceId: newInvoice.id, amount: parseFloat(data.payment.amount), method: data.payment.method || 'CASH', chequeNumber: data.payment.chequeNumber || null, bankName: data.payment.bankName || null, paymentDate: data.payment.paymentDate ? new Date(data.payment.paymentDate) : new Date(data.invoiceDate), notes: data.payment.notes || null } });
      }
      return newInvoice;
    });

    await logAudit({
      action: 'HISTORICAL_INVOICE_IMPORTED', entityType: 'INVOICE', entityId: invoice.id,
      userId: session?.id,
      description: `Historical invoice ${invoiceNumber} imported for ${client.name} — Total: K${total.toFixed(2)}`,
      newData: { invoiceNumber, total, clientId: data.clientId },
    });

    const completeInvoice = await prisma.invoice.findUnique({ where: { id: invoice.id }, include: { client: true, items: { include: { product: true } }, payments: true } });
    return NextResponse.json(completeInvoice, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'An invoice with this number already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create historical invoice', details: error.message }, { status: 500 });
  }
}