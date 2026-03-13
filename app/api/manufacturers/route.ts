
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    const where: any = {};

    if (search) {
      where.OR = [
        { name:          { contains: search } },
        { contactPerson: { contains: search } },
        { email:         { contains: search } },
        { phone:         { contains: search } },
        { motherCompany: { contains: search } },
      ];
    }

    const manufacturers = await prisma.manufacturer.findMany({ where, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(manufacturers);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manufacturers' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.name) return NextResponse.json({ error: 'Manufacturer name is required' }, { status: 400 });

    const manufacturer = await prisma.manufacturer.create({
      data: {
        name:          data.name,
        contactPerson: data.contactPerson?.trim() || null,
        phone:         data.phone?.trim()         || null,
        email:         data.email?.trim()         || null,
        motherCompany: data.motherCompany?.trim() || null,
        address:       data.address?.trim()       || null,
        location:      data.location?.trim()      || null,
      },
    });

    await logAudit({
      action: 'MANUFACTURER_CREATED', entityType: 'MANUFACTURER', entityId: manufacturer.id,
      userId: session?.id,
      description: `Manufacturer "${manufacturer.name}" added`,
      newData: { name: manufacturer.name, motherCompany: manufacturer.motherCompany },
    });

    return NextResponse.json(manufacturer, { status: 201 });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create manufacturer' }, { status: 500 });
  }
}