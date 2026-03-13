
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

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type   = searchParams.get('type');
    const search = searchParams.get('search');
    const where: any = {};

    if (type && type !== 'all') where.type = type;
    if (search) {
      where.OR = [
        { name:    { contains: search } },
        { email:   { contains: search } },
        { phone:   { contains: search } },
        { company: { contains: search } },
      ];
    }

    const clients = await prisma.client.findMany({ where, orderBy: { createdAt: 'desc' } });
    return NextResponse.json(clients);
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const data    = await request.json();

    if (!data.name?.trim()) {
      return NextResponse.json({ error: 'Client name is required' }, { status: 400 });
    }

    const client = await prisma.client.create({
      data: {
        name:        data.name.trim(),
        email:       data.email?.trim()   || null,
        phone:       data.phone?.trim()   || null,
        address:     data.address?.trim() || null,
        company:     data.company?.trim() || null,
        type:        data.type            || 'INDIVIDUAL',
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : null,
      },
    });

    await logAudit({
      action: 'CLIENT_CREATED', entityType: 'CLIENT', entityId: client.id,
      userId: session?.id,
      description: `Client "${client.name}" created`,
      newData: { name: client.name, type: client.type, email: client.email },
    });

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    if (error.code === 'P2002') return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 });
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}