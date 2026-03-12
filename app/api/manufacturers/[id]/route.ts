
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; oldData?: any; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: data.entityId ?? null, userId: data.userId ?? null, description: data.description ?? null, oldData: data.oldData ? JSON.stringify(data.oldData) : null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

interface Params { params: { id: string } }

export async function GET(_request: NextRequest, { params }: Params) {
  try {
    const manufacturer = await prisma.manufacturer.findUnique({ where: { id: params.id } });
    if (!manufacturer) return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });
    return NextResponse.json(manufacturer);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch manufacturer' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const session  = await getSession();
    const data     = await request.json();
    const existing = await prisma.manufacturer.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });

    const updated = await prisma.manufacturer.update({ where: { id: params.id }, data });

    await logAudit({
      action: 'MANUFACTURER_UPDATED', entityType: 'MANUFACTURER', entityId: params.id,
      userId: session?.id,
      description: `Manufacturer "${updated.name}" updated`,
      oldData: { name: existing.name, motherCompany: existing.motherCompany },
      newData: { name: updated.name,  motherCompany: updated.motherCompany  },
    });

    return NextResponse.json(updated);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update manufacturer' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    const session  = await getSession();
    const existing = await prisma.manufacturer.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Manufacturer not found' }, { status: 404 });

    await prisma.manufacturer.delete({ where: { id: params.id } });

    await logAudit({
      action: 'MANUFACTURER_DELETED', entityType: 'MANUFACTURER', entityId: params.id,
      userId: session?.id,
      description: `Manufacturer "${existing.name}" deleted`,
      oldData: { name: existing.name, motherCompany: existing.motherCompany },
    });

    return NextResponse.json({ message: 'Manufacturer deleted' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete manufacturer' }, { status: 500 });
  }
}
