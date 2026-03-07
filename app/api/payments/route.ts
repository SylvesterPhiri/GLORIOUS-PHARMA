// app/api/payments/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const method = searchParams.get('method');
    const invoiceId = searchParams.get('invoiceId');

    // Build where clause
    const where: any = {};

    if (startDate || endDate) {
      where.paymentDate = {};
      if (startDate) where.paymentDate.gte = new Date(startDate);
      if (endDate) where.paymentDate.lte = new Date(endDate);
    }

    if (method) {
      where.method = method;
    }

    if (invoiceId) {
      where.invoiceId = invoiceId;
    }

    const payments = await prisma.payment.findMany({
      where,
      include: {
        invoice: {
          include: {
            client: {
              select: {
                id: true,
                name: true,
                email: true,
                phone: true
              }
            }
          }
        }
      },
      orderBy: { paymentDate: 'desc' }
    });

    // Calculate totals
    const totalAmount = payments.reduce((sum, p) => sum + p.amount, 0);
    
    // Group by payment method for stats
    const byMethod = payments.reduce((acc: Record<string, { count: number; total: number }>, p) => {
      if (!acc[p.method]) acc[p.method] = { count: 0, total: 0 };
      acc[p.method].count++;
      acc[p.method].total += p.amount;
      return acc;
    }, {});

    return NextResponse.json({
      payments,
      summary: {
        totalCount: payments.length,
        totalAmount,
        byMethod
      }
    });
  } catch (error) {
    console.error('GET /api/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { invoiceId, amount, method, chequeNumber, bankName, paymentDate, notes } = body;

    // Validation
    if (!invoiceId) {
      return NextResponse.json(
        { error: 'Invoice ID is required' },
        { status: 400 }
      );
    }

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    // Check if invoice exists
    const invoice = await prisma.invoice.findUnique({
      where: { id: invoiceId },
      include: { payments: true }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Create payment
    const payment = await prisma.payment.create({
      data: {
        invoiceId,
        amount,
        method: method || 'CASH',
        chequeNumber,
        bankName,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes
      },
      include: {
        invoice: {
          include: {
            client: true
          }
        }
      }
    });

    // Calculate total paid so far
    const allPayments = await prisma.payment.findMany({
      where: { invoiceId }
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    // If total paid equals or exceeds invoice total, update invoice status to PAID
    if (totalPaid >= invoice.total && invoice.status !== 'PAID') {
      await prisma.invoice.update({
        where: { id: invoiceId },
        data: { status: 'PAID' }
      });
    }

    // Log audit
    await prisma.auditLog.create({
      data: {
        action: 'PAYMENT_CREATED',
        entityType: 'PAYMENT',
        entityId: payment.id,
        userId: session.id,
        description: `Payment of K${amount} received for invoice ${invoice.invoiceNumber}`,
        newData: JSON.stringify({
          amount,
          method,
          invoiceNumber: invoice.invoiceNumber
        })
      }
    });

    return NextResponse.json({ success: true, payment }, { status: 201 });
  } catch (error) {
    console.error('POST /api/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}