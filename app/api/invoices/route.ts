
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { InvoiceStatus } from '@prisma/client';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: {
  action: string; entityType: string; entityId?: string;
  userId?: string; description?: string; oldData?: any; newData?: any; changes?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action, entityType: data.entityType,
        entityId: data.entityId ?? null, userId: data.userId ?? null,
        description: data.description ?? null,
        oldData:  data.oldData  ? JSON.stringify(data.oldData)  : null,
        newData:  data.newData  ? JSON.stringify(data.newData)  : null,
        changes:  data.changes  ? JSON.stringify(data.changes)  : null,
      },
    });
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const status = searchParams.get('status') || '';
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '50');
    const skip   = (page - 1) * limit;

    const where: any = {};
    if (search) {
      where.OR = [
        { invoiceNumber: { contains: search } },
        { client: { name: { contains: search } } },
      ];
    }
    if (status) where.status = status;

    const [invoices, total] = await Promise.all([
      prisma.invoice.findMany({
        where,
        include: {
          client:   { select: { id: true, name: true, email: true, phone: true } },
          items:    { include: { product: { select: { name: true, price: true } } } },
          payments: true,
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.invoice.count({ where }),
    ]);

    return NextResponse.json({ invoices, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch invoices', details: error.message }, { status: 500 });
  }
}

function resolveStatus(status: string): InvoiceStatus {
  const map: Record<string, InvoiceStatus> = {
    UNPAID: InvoiceStatus.PENDING, PENDING: InvoiceStatus.PENDING,
    DRAFT: InvoiceStatus.DRAFT, PAID: InvoiceStatus.PAID,
    OVERDUE: InvoiceStatus.OVERDUE, CANCELLED: InvoiceStatus.CANCELLED,
  };
  return map[status] ?? InvoiceStatus.PENDING;
}

interface InvoiceItemInput {
  productId?: string; productName?: string; productSku?: string;
  quantity: number; unitPrice?: number; price?: number;
  freeSamples?: number; freeSample?: number;
}

interface PreparedItem {
  productId: string | null; productSnapshot: string | null;
  quantity: number; freeSamples: number; unitPrice: number; totalPrice: number;
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    const isHistorical: boolean     = Boolean(data.isHistorical ?? false);
    const affectsInventory: boolean = isHistorical ? false : Boolean(data.affectsInventory ?? true);
    const historicalNote: string | null = data.historicalNote ?? null;

    if (!data.clientId)      return NextResponse.json({ error: 'Client is required' }, { status: 400 });
    if (!data.invoiceDate)   return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 });
    if (!data.dueDate)       return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
    if (!data.items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

    for (const item of data.items as InvoiceItemInput[]) {
      if (!isHistorical && !item.productId) return NextResponse.json({ error: 'All items must have a product selected' }, { status: 400 });
      if (isHistorical && !item.productId && !item.productName?.trim()) return NextResponse.json({ error: 'Historical items must have a product name' }, { status: 400 });
      if (!item.quantity || item.quantity <= 0) return NextResponse.json({ error: 'All items must have a valid quantity' }, { status: 400 });
      const price = item.unitPrice ?? item.price;
      if (price === undefined || price === null || price < 0) return NextResponse.json({ error: 'All items must have a valid price' }, { status: 400 });
    }

    if (!isHistorical && affectsInventory) {
      for (const item of data.items as InvoiceItemInput[]) {
        const freeSamples = parseInt(String(item.freeSamples ?? item.freeSample ?? 0)) || 0;
        const totalNeeded = item.quantity + freeSamples;

        const product = await prisma.product.findUnique({
          where: { id: item.productId! },
          select: { currentStock: true, name: true },
        });
        if (!product) return NextResponse.json({ error: `Product not found: ${item.productId}` }, { status: 404 });
        if (product.currentStock < totalNeeded) {
          return NextResponse.json({
            error: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Required: ${item.quantity} sold + ${freeSamples} free = ${totalNeeded}`,
          }, { status: 400 });
        }
      }
    }

    const invoiceNumber = data.invoiceNumber || (isHistorical ? `HIST-${Date.now()}` : `INV-${Date.now()}`);

    let subTotal = 0;
    const invoiceItemsData: PreparedItem[] = [];

    for (const item of data.items as InvoiceItemInput[]) {
      const resolvedPrice = item.unitPrice ?? item.price;
      let fallbackPrice = 0;
      if (item.productId) {
        const p = await prisma.product.findUnique({ where: { id: item.productId }, select: { price: true } });
        fallbackPrice = p?.price ?? 0;
      }
      const unitPrice   = parseFloat(String(resolvedPrice)) || fallbackPrice;
      const quantity    = parseInt(String(item.quantity));
      const freeSamples = parseInt(String(item.freeSamples ?? item.freeSample ?? 0)) || 0;

      const totalPrice = quantity * unitPrice;
      subTotal += totalPrice;

      const productSnapshot = !item.productId && item.productName
        ? JSON.stringify({ name: item.productName.trim(), sku: item.productSku?.trim() ?? null })
        : null;

      invoiceItemsData.push({ productId: item.productId ?? null, productSnapshot, quantity, freeSamples, unitPrice, totalPrice });
    }

    const tax   = parseFloat(data.tax) || 0;
    const total = subTotal + tax;

    const invoice = await prisma.$transaction(async (tx) => {
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId:    data.clientId,
          invoiceDate: new Date(data.invoiceDate),
          dueDate:     new Date(data.dueDate),
          status:      resolveStatus(data.status),
          subTotal, tax, total,
          notes: data.notes || null,
          isHistorical, affectsInventory, historicalNote,
        },
        include: { client: true },
      });

      for (const itemData of invoiceItemsData) {
        await tx.invoiceItem.create({
          data: {
            invoiceId: newInvoice.id, productId: itemData.productId,
            productSnapshot: itemData.productSnapshot,
            quantity: itemData.quantity, freeSamples: itemData.freeSamples,
            unitPrice: itemData.unitPrice, totalPrice: itemData.totalPrice,
          },
        });

        if (!isHistorical && affectsInventory && itemData.productId) {
          await tx.product.update({
            where: { id: itemData.productId },
            data:  { currentStock: { decrement: itemData.quantity + itemData.freeSamples } },
          });
        }
      }

      if (data.payment?.amount > 0) {
        await tx.payment.create({
          data: {
            invoiceId:    newInvoice.id,
            amount:       parseFloat(data.payment.amount),
            method:       data.payment.method       || 'CASH',
            chequeNumber: data.payment.chequeNumber || null,
            bankName:     data.payment.bankName     || null,
            paymentDate:  data.payment.paymentDate ? new Date(data.payment.paymentDate) : new Date(),
            notes:        data.payment.notes || null,
          },
        });
      }

      return newInvoice;
    });

    await logAudit({
      action:      isHistorical ? 'HISTORICAL_INVOICE_IMPORTED' : 'INVOICE_CREATED',
      entityType:  'INVOICE',
      entityId:    invoice.id,
      userId:      session?.id,
      description: `Invoice ${invoiceNumber} created for ${invoice.client.name} — Total: K${total.toFixed(2)}`,
      newData:     { invoiceNumber, total, status: data.status },
    });

    const completeInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: { client: true, items: { include: { product: true } }, payments: true },
    });

    return NextResponse.json(completeInvoice, { status: 201 });
  } catch (error: any) {
    console.error('Error creating invoice:', error);
    if (error.code === 'P2002') return NextResponse.json({ error: 'Invoice number already exists' }, { status: 400 });
    if (error.code === 'P2003') return NextResponse.json({ error: 'Invalid client or product ID' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create invoice', details: error.message }, { status: 500 });
  }
}