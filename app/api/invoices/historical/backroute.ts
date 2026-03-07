import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { InvoiceStatus } from '@prisma/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface HistoricalItemInput {
  productId?:    string;   // optional — product may no longer exist
  productName:   string;   // always required — used as fallback display name
  productSku?:   string;   // optional reference
  quantity:      number;
  unitPrice:     number;
  freeSamples?:  number;
}

// Map any frontend status string to a valid InvoiceStatus enum value
function resolveStatus(status?: string): InvoiceStatus {
  const map: Record<string, InvoiceStatus> = {
    PAID:      InvoiceStatus.PAID,
    PENDING:   InvoiceStatus.PENDING,
    UNPAID:    InvoiceStatus.PENDING,
    OVERDUE:   InvoiceStatus.OVERDUE,
    DRAFT:     InvoiceStatus.DRAFT,
    CANCELLED: InvoiceStatus.CANCELLED,
  };
  return map[status?.toUpperCase() ?? ''] ?? InvoiceStatus.PAID;
}

// ─── GET — list historical invoices only ─────────────────────────────────────

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
          client: {
            select: { id: true, name: true, email: true, phone: true },
          },
          items: {
            include: {
              product: {
                select: { name: true, price: true },
              },
            },
          },
          payments: true,
        },
        orderBy: { invoiceDate: 'desc' },
        skip,
        take: limit,
      }),
      prisma.invoice.count({ where: { isHistorical: true } }),
    ]);

    return NextResponse.json({
      invoices,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error: any) {
    console.error('Error fetching historical invoices:', error);
    return NextResponse.json(
      { error: 'Failed to fetch historical invoices', details: error.message },
      { status: 500 }
    );
  }
}

// ─── POST — create a historical invoice ──────────────────────────────────────
// This endpoint ALWAYS sets isHistorical=true and affectsInventory=false.
// Stock is NEVER touched, stock validation is NEVER run.

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

    console.log('Creating historical invoice:', JSON.stringify(data, null, 2));

    // ── Validate required fields ──────────────────────────────────────────
    if (!data.clientId) {
      return NextResponse.json({ error: 'Client is required' }, { status: 400 });
    }
    if (!data.invoiceDate) {
      return NextResponse.json({ error: 'Invoice date is required' }, { status: 400 });
    }
    if (!data.dueDate) {
      return NextResponse.json({ error: 'Due date is required' }, { status: 400 });
    }
    if (!data.items || data.items.length === 0) {
      return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });
    }

    // ── Validate line items ───────────────────────────────────────────────
    for (const item of data.items as HistoricalItemInput[]) {
      if (!item.productName?.trim()) {
        return NextResponse.json(
          { error: 'Every item must have a product name' },
          { status: 400 }
        );
      }
      if (!item.quantity || item.quantity < 1) {
        return NextResponse.json(
          { error: `Quantity must be at least 1 for: ${item.productName}` },
          { status: 400 }
        );
      }
      if (item.unitPrice === undefined || item.unitPrice < 0) {
        return NextResponse.json(
          { error: `Invalid unit price for: ${item.productName}` },
          { status: 400 }
        );
      }
    }

    // ── Verify client exists ──────────────────────────────────────────────
    const client = await prisma.client.findUnique({
      where: { id: data.clientId },
      select: { id: true, name: true },
    });
    if (!client) {
      return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    }

    // ── Invoice number — always prefixed with HIST- ───────────────────────
    const invoiceNumber: string =
      data.invoiceNumber?.trim() || `HIST-${Date.now()}`;

    // ── Build line items ──────────────────────────────────────────────────
    let subTotal = 0;

    interface PreparedItem {
      productId:       string | null;
      productSnapshot: string;
      quantity:        number;
      freeSamples:     number;
      unitPrice:       number;
      totalPrice:      number;
    }

    const preparedItems: PreparedItem[] = [];

    for (const item of data.items as HistoricalItemInput[]) {
      const quantity    = parseInt(String(item.quantity));
      const freeSamples = parseInt(String(item.freeSamples ?? 0)) || 0;
      const unitPrice   = parseFloat(String(item.unitPrice));
      const paidQty     = quantity - freeSamples;
      const totalPrice  = paidQty * unitPrice;

      subTotal += totalPrice;

      // Try to resolve the productId if the product still exists in the system
      let resolvedProductId: string | null = null;
      if (item.productId) {
        const exists = await prisma.product.findUnique({
          where: { id: item.productId },
          select: { id: true },
        });
        if (exists) resolvedProductId = exists.id;
      }

      // Always store a snapshot so reports have the name even if product is deleted
      const productSnapshot = JSON.stringify({
        name:     item.productName.trim(),
        sku:      item.productSku?.trim() ?? null,
        category: null,
      });

      preparedItems.push({
        productId:       resolvedProductId,
        productSnapshot,
        quantity,
        freeSamples,
        unitPrice,
        totalPrice,
      });
    }

    const tax   = parseFloat(data.tax) || 0;
    const total = subTotal + tax;
    const resolvedStatus = resolveStatus(data.status);

    // ── Create everything in a transaction ────────────────────────────────
    const invoice = await prisma.$transaction(async (tx) => {

      // 1. Create the invoice — always historical, never affects inventory
      const newInvoice = await tx.invoice.create({
        data: {
          invoiceNumber,
          clientId:        data.clientId,
          invoiceDate:     new Date(data.invoiceDate),
          dueDate:         new Date(data.dueDate),
          status:          resolvedStatus,
          subTotal,
          tax,
          total,
          notes:           data.notes || null,
          isHistorical:    true,   // ← always true on this endpoint
          affectsInventory: false, // ← always false — stock is NEVER touched
          historicalNote:  data.historicalNote || null,
        },
      });

      // 2. Create line items — NO stock.update() anywhere here
      for (const item of preparedItems) {
        await tx.invoiceItem.create({
          data: {
            invoiceId:       newInvoice.id,
            productId:       item.productId,       // null if product deleted
            productSnapshot: item.productSnapshot, // always present
            quantity:        item.quantity,
            freeSamples:     item.freeSamples,
            unitPrice:       item.unitPrice,
            totalPrice:      item.totalPrice,
          },
        });
        // ✅ tx.product.update is intentionally absent — stock never changes
      }

      // 3. Attach a payment record if provided (historical invoices are usually PAID)
      if (data.payment && data.payment.amount > 0) {
        await tx.payment.create({
          data: {
            invoiceId:    newInvoice.id,
            amount:       parseFloat(data.payment.amount),
            method:       data.payment.method   || 'CASH',
            chequeNumber: data.payment.chequeNumber || null,
            bankName:     data.payment.bankName    || null,
            paymentDate:  data.payment.paymentDate
              ? new Date(data.payment.paymentDate)
              : new Date(data.invoiceDate), // default to invoice date for historical
            notes: data.payment.notes || null,
          },
        });
      }

      return newInvoice;
    });

    console.log(`✅ Historical invoice created: ${invoice.invoiceNumber} — stock untouched`);

    // Return the complete invoice
    const completeInvoice = await prisma.invoice.findUnique({
      where: { id: invoice.id },
      include: {
        client: true,
        items:  { include: { product: true } },
        payments: true,
      },
    });

    return NextResponse.json(completeInvoice, { status: 201 });

  } catch (error: any) {
    console.error('Error creating historical invoice:', error);

    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'An invoice with this number already exists' },
        { status: 400 }
      );
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create historical invoice', details: error.message },
      { status: 500 }
    );
  }
}
