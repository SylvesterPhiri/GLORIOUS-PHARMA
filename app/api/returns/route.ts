import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib//prisma'; // adjust import to match your project

export async function GET() {
  try {
    const returns = await prisma.return.findMany({
      include: {
        invoice: { include: { client: true } },
        product: true,
      },
      orderBy: { returnDate: 'desc' },
    });
    return NextResponse.json({ returns });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch returns' }, { status: 500 });
  }
}