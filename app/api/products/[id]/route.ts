
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
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

interface RouteParams { params: { id: string } }

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const product = await prisma.product.findUnique({
      where: { id: params.id },
      include: { manufacturer: { select: { id: true, name: true, motherCompany: true } } },
    });
    if (!product) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const response = NextResponse.json({
      ...product,
      stockStatus:    product.currentStock <= product.minStock ? 'LOW' : 'GOOD',
      isExpired:      new Date(product.expiryDate) < new Date(),
      isExpiringSoon: new Date(product.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch product', details: error.message }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const data    = await request.json();
    const { id }  = params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    if (!data.name?.trim())        return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    if (!data.manufacturerId)      return NextResponse.json({ error: 'Manufacturer is required' }, { status: 400 });
    if (!data.batchNumber?.trim()) return NextResponse.json({ error: 'Batch number is required' }, { status: 400 });
    if (!data.expiryDate)          return NextResponse.json({ error: 'Expiry date is required' }, { status: 400 });

    const updateData = {
      name:           data.name.trim(),
      genericName:    data.genericName?.trim() || null,
      type:           data.type           || existing.type,
      category:       data.category?.trim() || null,
      unit:           data.unit           || existing.unit,
      price:          data.price          !== undefined ? parseFloat(data.price)       : existing.price,
      currentStock:   data.currentStock   !== undefined ? parseInt(data.currentStock)  : existing.currentStock,
      minStock:       data.minStock       !== undefined ? parseInt(data.minStock)       : existing.minStock,
      manufacturerId: data.manufacturerId,
      batchNumber:    data.batchNumber.trim(),
      expiryDate:     new Date(data.expiryDate),
    };

    if (updateData.price < 0)        return NextResponse.json({ error: 'Price cannot be negative' }, { status: 400 });
    if (updateData.currentStock < 0) return NextResponse.json({ error: 'Current stock cannot be negative' }, { status: 400 });
    if (updateData.minStock < 0)     return NextResponse.json({ error: 'Minimum stock cannot be negative' }, { status: 400 });

    const updated = await prisma.product.update({
      where: { id },
      data:  updateData,
      include: { manufacturer: { select: { id: true, name: true, motherCompany: true } } },
    });

    const changes: Record<string, { from: any; to: any }> = {};
    const trackFields = ['name', 'price', 'currentStock', 'minStock', 'batchNumber', 'type', 'category'] as const;
    for (const f of trackFields) {
      if (String((existing as any)[f] ?? '') !== String((updated as any)[f] ?? '')) {
        changes[f] = { from: (existing as any)[f], to: (updated as any)[f] };
      }
    }

    const isStockAdjustment = changes.currentStock !== undefined;
    await logAudit({
      action:      isStockAdjustment ? 'STOCK_ADJUSTED' : 'PRODUCT_UPDATED',
      entityType:  'PRODUCT',
      entityId:    id,
      userId:      session?.id,
      description: isStockAdjustment
        ? `Stock adjusted for "${updated.name}": ${changes.currentStock.from} → ${changes.currentStock.to}`
        : `Product "${updated.name}" updated`,
      oldData: { name: existing.name, price: existing.price, currentStock: existing.currentStock },
      newData: { name: updated.name,  price: updated.price,  currentStock: updated.currentStock  },
      changes,
    });

    const response = NextResponse.json(updated);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'A product with this name already exists' }, { status: 400 });
    if (error.code === 'P2003') return NextResponse.json({ error: 'Invalid manufacturer ID' }, { status: 400 });
    if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to update product', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    const { id }  = params;

    const existing = await prisma.product.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'Product not found' }, { status: 404 });

    const invoiceItems = await prisma.invoiceItem.count({ where: { productId: id } });
    if (invoiceItems > 0) {
      return NextResponse.json({ error: 'Cannot delete product that is used in invoices' }, { status: 400 });
    }

    await prisma.product.delete({ where: { id } });

    await logAudit({
      action: 'PRODUCT_DELETED', entityType: 'PRODUCT', entityId: id,
      userId: session?.id,
      description: `Product "${existing.name}" deleted (batch: ${existing.batchNumber}, stock was: ${existing.currentStock})`,
      oldData: { name: existing.name, batchNumber: existing.batchNumber, currentStock: existing.currentStock, price: existing.price },
    });

    const response = NextResponse.json({ success: true, message: 'Product deleted successfully' });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    if (error.code === 'P2025') return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    return NextResponse.json({ error: 'Failed to delete product', details: error.message }, { status: 500 });
  }
}
