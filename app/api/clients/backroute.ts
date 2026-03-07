// app/api/clients/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const type   = searchParams.get('type');
    const search = searchParams.get('search');

    const where: any = {};

    if (type && type !== 'all') {
      where.type = type;
    }

    // SQLite: no mode:'insensitive' — plain contains works fine
    if (search) {
      where.OR = [
        { name:    { contains: search } },
        { email:   { contains: search } },
        { phone:   { contains: search } },
        { company: { contains: search } },
      ];
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json(clients);
  } catch (error) {
    console.error('Error fetching clients:', error);
    return NextResponse.json({ error: 'Failed to fetch clients' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();

    // Only name is required
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

    return NextResponse.json(client, { status: 201 });
  } catch (error: any) {
    console.error('Error creating client:', error);
    if (error.code === 'P2002') {
      return NextResponse.json({ error: 'A client with this email already exists' }, { status: 400 });
    }
    return NextResponse.json({ error: 'Failed to create client' }, { status: 500 });
  }
}
