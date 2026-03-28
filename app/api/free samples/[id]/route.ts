// app/api/free-samples/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; oldData?: any; newData?: any }) {
  try {
    await prisma.auditLog.create({
      data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, oldData: data.oldData ? JSON.stringify(data.oldData) : null, newData: data.newData ? JSON.stringify(data.newData) : null },
    });
  } catch {}
}

interface Params { params: { id: string } }

export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const record = await prisma.freeSampleRecord.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: { select: { id: true, name: true, currentStock: true } } } } },
    });
    if (!record) return NextResponse.json({ error: 'Record not found' }, { status: 404 });
    return NextResponse.json({ record });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch record' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.date)          return NextResponse.json({ error: 'Date is required' }, { status: 400 });
    if (!data.items?.length) return NextResponse.json({ error: 'At least one item is required' }, { status: 400 });

    // Get existing record with items
    const existing = await prisma.freeSampleRecord.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: { select: { id: true, name: true } } } } },
    });
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    // Build maps of old quantities per product
    const oldQtyMap: Record<string, number> = {};
    for (const item of existing.items) {
      oldQtyMap[item.productId] = (oldQtyMap[item.productId] ?? 0) + item.quantity;
    }

    // Build maps of new quantities per product
    const newQtyMap: Record<string, number> = {};
    for (const item of data.items) {
      newQtyMap[item.productId] = (newQtyMap[item.productId] ?? 0) + parseInt(String(item.quantity));
    }

    // Check stock for any increases needed
    const allProductIds = new Set([...Object.keys(oldQtyMap), ...Object.keys(newQtyMap)]);
    for (const productId of allProductIds) {
      const oldQty  = oldQtyMap[productId] ?? 0;
      const newQty  = newQtyMap[productId] ?? 0;
      const delta   = newQty - oldQty; // positive = need more stock
      if (delta > 0) {
        const product = await prisma.product.findUnique({ where: { id: productId }, select: { name: true, currentStock: true } });
        if (!product) return NextResponse.json({ error: `Product not found` }, { status: 404 });
        if (product.currentStock < delta) {
          return NextResponse.json({ error: `Insufficient stock for ${product.name}. Available: ${product.currentStock}, Additional needed: ${delta}` }, { status: 400 });
        }
      }
    }

    // Update everything in a transaction
    const updated = await prisma.$transaction(async (tx) => {
      // Restore old stock
      for (const [productId, qty] of Object.entries(oldQtyMap)) {
        await tx.product.update({ where: { id: productId }, data: { currentStock: { increment: qty } } });
      }

      // Delete old items
      await tx.freeSampleItem.deleteMany({ where: { recordId: params.id } });

      // Create new items and deduct new stock
      for (const item of data.items) {
        await tx.freeSampleItem.create({
          data: { recordId: params.id, productId: item.productId, quantity: parseInt(String(item.quantity)) },
        });
        await tx.product.update({
          where: { id: item.productId },
          data:  { currentStock: { decrement: parseInt(String(item.quantity)) } },
        });
      }

      // Update record date/notes
      return tx.freeSampleRecord.update({
        where: { id: params.id },
        data:  { date: new Date(data.date), notes: data.notes?.trim() || null },
        include: { items: { include: { product: { select: { id: true, name: true } } } } },
      });
    });

    await logAudit({
      action: 'FREE_SAMPLE_UPDATED', entityType: 'FREE_SAMPLE', entityId: params.id,
      userId: session?.id,
      description: `Free sample record updated`,
      oldData: { date: existing.date, items: existing.items.map((i) => ({ productId: i.productId, quantity: i.quantity })) },
      newData: { date: data.date, items: data.items },
    });

    return NextResponse.json({ success: true, record: updated });
  } catch (error: any) {
    console.error('Free sample update error:', error);
    return NextResponse.json({ error: 'Failed to update record', details: error.message }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const session = await getSession();

    const existing = await prisma.freeSampleRecord.findUnique({
      where: { id: params.id },
      include: { items: { include: { product: { select: { name: true } } } } },
    });
    if (!existing) return NextResponse.json({ error: 'Record not found' }, { status: 404 });

    // Restore stock before deleting
    await prisma.$transaction(async (tx) => {
      for (const item of existing.items) {
        await tx.product.update({ where: { id: item.productId }, data: { currentStock: { increment: item.quantity } } });
      }
      await tx.freeSampleRecord.delete({ where: { id: params.id } });
    });

    await logAudit({
      action: 'FREE_SAMPLE_DELETED', entityType: 'FREE_SAMPLE', entityId: params.id,
      userId: session?.id,
      description: `Free sample record deleted — stock restored`,
      oldData: { date: existing.date, items: existing.items.map((i) => ({ product: i.product.name, quantity: i.quantity })) },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to delete record', details: error.message }, { status: 500 });
  }
}
