// app/api/accounting/expenses/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET() {
  try {
    const expenses = await prisma.expense.findMany({ orderBy: { date: 'desc' } });
    return NextResponse.json({ expenses });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch expenses' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { description, amount, category, date } = await request.json();
    if (!description || !amount) {
      return NextResponse.json({ error: 'Description and amount required' }, { status: 400 });
    }
    const expense = await prisma.expense.create({
      data: {
        description,
        amount:   parseFloat(amount),
        category: category ?? 'Operations',
        date:     date ? new Date(date) : new Date(),
      },
    });
    return NextResponse.json({ success: true, expense }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to create expense' }, { status: 500 });
  }
}
