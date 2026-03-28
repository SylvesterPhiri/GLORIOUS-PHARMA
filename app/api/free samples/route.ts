// app/api/free-samples/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try {
    await prisma.auditLog.create({
      data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null },
    });
  } catch {}
}

export async function GET() {
  try {
    const records = await prisma.freeSampleRecord.findMany({
      include: {
        items: {
          include: { product: { select: { id: true, name: true, currentStock: true } } },
        },
      },
      orderBy: { date: 'desc' },
    });
    return NextResponse.json({ records });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch free sample records', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.date)          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!data.items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

    // Validate items
    for (const item of data.items) {
      if (!item.productId)          return NextResponse.json({ error: 'Each item must have a product selected' }, { status: 400 });
      if (!item.quantity || item.quantity < 1) return NextResponse.json({ error: 'Each item must have a quantity of at least 1' }, { status: 400 });
    }

    // Check stock availability for all items
    for (const item of data.items) {
      const product = await prisma.product.findUnique({ where: { id: item.productId }, select: { name: true, currentStock: true } });
      if (!product) return NextResponse.json({ error: `Product not found` }, { status: 404 });
      if (product.currentStock < item.quantity) {
        return NextResponse.json({ error: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Requested: ${item.quantity}` }, { status: 400 });
      }
    }

    // Create record and deduct stock in a transaction
    const record = await prisma.$transaction(async (tx) => {
      const newRecord = await tx.freeSampleRecord.create({
        data: {
          date:  new Date(data.date),
          notes: data.notes?.trim() || null,
          items: {
            create: data.items.map((item: any) => ({
              productId: item.productId,
              quantity:  parseInt(String(item.quantity)),
            })),
          },
        },
        include: {
          items: { include: { product: { select: { id: true, name: true } } } },
        },
      });

      // Deduct stock for each item
      for (const item of data.items) {
        await tx.product.update({
          where: { id: item.productId },
          data:  { currentStock: { decrement: parseInt(String(item.quantity)) } },
        });
      }

      return newRecord;
    });

    const itemSummary = record.items.map((i) => `${i.product.name} x${i.quantity}`).join(', ');
    await logAudit({
      action: 'FREE_SAMPLE_CREATED', entityType: 'FREE_SAMPLE', entityId: record.id,
      userId: session?.id,
      description: `Free sample record created: ${itemSummary}`,
      newData: { date: data.date, items: data.items },
    });

    return NextResponse.json({ success: true, record }, { status: 201 });
  } catch (error: any) {
    console.error('Free sample create error:', error);
    return NextResponse.json({ error: 'Failed to create free sample record', details: error.message }, { status: 500 });
  }
}
