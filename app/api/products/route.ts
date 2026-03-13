
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: {
  action: string; entityType: string; entityId?: string;
  userId?: string; description?: string; oldData?: any; newData?: any;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action, entityType: data.entityType,
        entityId: data.entityId ?? null, userId: data.userId ?? null,
        description: data.description ?? null,
        oldData: data.oldData ? JSON.stringify(data.oldData) : null,
        newData: data.newData ? JSON.stringify(data.newData) : null,
      },
    });
  } catch {}
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page   = parseInt(searchParams.get('page')  || '1');
    const limit  = parseInt(searchParams.get('limit') || '20');
    const skip   = (page - 1) * limit;

    const where = search ? {
      OR: [
        { name:        { contains: search } },
        { genericName: { contains: search } },
        { batchNumber: { contains: search } },
      ],
    } : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: { manufacturer: { select: { name: true, motherCompany: true } } },
        orderBy: { name: 'asc' },
        skip, take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    const productsWithStatus = products.map((p) => ({
      ...p,
      stockStatus:    p.currentStock <= p.minStock ? 'LOW' : 'GOOD',
      isExpired:      new Date(p.expiryDate) < new Date(),
      isExpiringSoon: new Date(p.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));

    const response = NextResponse.json({ products: productsWithStatus, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch products', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.name?.trim())         return NextResponse.json({ error: 'Product name is required' }, { status: 400 });
    if (!data.manufacturerId)       return NextResponse.json({ error: 'Manufacturer is required' }, { status: 400 });
    if (!data.batchNumber?.trim())  return NextResponse.json({ error: 'Batch number is required' }, { status: 400 });
    if (!data.expiryDate)           return NextResponse.json({ error: 'Expiry date is required' }, { status: 400 });

    const product = await prisma.product.create({
      data: {
        name:           data.name.trim(),
        genericName:    data.genericName?.trim() || null,
        type:           data.type         || 'TABLET',
        category:       data.category?.trim() || null,
        manufacturerId: data.manufacturerId,
        batchNumber:    data.batchNumber.trim(),
        expiryDate:     new Date(data.expiryDate),
        unit:           data.unit         || 'pack',
        price:          parseFloat(data.price)        || 0,
        initialStock:   parseInt(data.initialStock)   || 0,
        currentStock:   parseInt(data.initialStock)   || 0,
        minStock:       parseInt(data.minStock)        || 10,
      },
      include: { manufacturer: true },
    });

    await logAudit({
      action: 'PRODUCT_CREATED', entityType: 'PRODUCT', entityId: product.id,
      userId: session?.id,
      description: `Product "${product.name}" added — Stock: ${product.currentStock}, Price: K${product.price}`,
      newData: { name: product.name, currentStock: product.currentStock, price: product.price, batchNumber: product.batchNumber },
    });

    const response = NextResponse.json(product, { status: 201 });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    return response;
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'A product with this name already exists' }, { status: 400 });
    if (error.code === 'P2003') return NextResponse.json({ error: 'Invalid manufacturer ID' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create product', details: error.message }, { status: 500 });
  }
}