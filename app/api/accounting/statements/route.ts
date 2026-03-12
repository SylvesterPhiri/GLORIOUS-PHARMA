
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('client') || '';

    if (!search.trim()) return NextResponse.json({ invoices: [] });

    const invoices = await prisma.invoice.findMany({
      where: { isHistorical: false, client: { name: { contains: search } } },
      include: { client: { select: { name: true, email: true, phone: true } }, payments: true },
      orderBy: { invoiceDate: 'desc' },
    });

    return NextResponse.json({ invoices });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to search client statements', details: error.message }, { status: 500 });
  }
}
