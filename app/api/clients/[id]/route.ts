// app/api/clients/[id]/route.ts
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

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        invoices: {
          include: { items: true, payments: true },
          orderBy: { createdAt: 'desc' },
          take: 10,
        },
      },
    });
    if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch client' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();
    const body    = await request.json();

    if (!body.name?.trim()) return NextResponse.json({ error: 'Client name is required' }, { status: 400 });

    const existing = await prisma.client.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name:        body.name,
        email:       body.email       || null,
        phone:       body.phone       || null,
        address:     body.address     || null,
        company:     body.company     || null,
        type:        body.type        || 'INDIVIDUAL',
        creditLimit: body.creditLimit ? parseFloat(body.creditLimit) : 0,
      },
    });

    // Build changes object — only fields that actually changed
    const changes: Record<string, { from: any; to: any }> = {};
    const fields = ['name', 'email', 'phone', 'address', 'company', 'type', 'creditLimit'] as const;
    for (const f of fields) {
      if (String((existing as any)[f] ?? '') !== String((client as any)[f] ?? '')) {
        changes[f] = { from: (existing as any)[f], to: (client as any)[f] };
      }
    }

    await logAudit({
      action: 'CLIENT_UPDATED', entityType: 'CLIENT', entityId: client.id,
      userId: session?.id,
      description: `Client "${client.name}" updated`,
      oldData: { name: existing.name, email: existing.email, phone: existing.phone, type: existing.type },
      newData: { name: client.name,   email: client.email,   phone: client.phone,   type: client.type },
      changes,
    });

    return NextResponse.json(client);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to update client' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const session = await getSession();

    const existing = await prisma.client.findUnique({ where: { id: params.id } });
    if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

    const invoiceCount = await prisma.invoice.count({ where: { clientId: params.id } });
    if (invoiceCount > 0) {
      return NextResponse.json({ error: 'Cannot delete client with existing invoices' }, { status: 400 });
    }

    await prisma.client.delete({ where: { id: params.id } });

    await logAudit({
      action: 'CLIENT_DELETED', entityType: 'CLIENT', entityId: params.id,
      userId: session?.id,
      description: `Client "${existing.name}" deleted`,
      oldData: { name: existing.name, email: existing.email, type: existing.type },
    });

    return NextResponse.json({ message: 'Client deleted successfully' });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete client' }, { status: 500 });
  }
}
