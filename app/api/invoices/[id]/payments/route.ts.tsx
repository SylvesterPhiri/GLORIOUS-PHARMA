
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      select: { 
        id: true, 
        invoiceNumber: true, 
        total: true,
        status: true 
      }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const payments = await prisma.payment.findMany({
      where: { invoiceId: id },
      orderBy: { paymentDate: 'desc' }
    });

    const totalPaid = payments.reduce((sum, p) => sum + p.amount, 0);
    const remainingBalance = Math.max(invoice.total - totalPaid, 0);

    const byMethod = payments.reduce((acc: Record<string, number>, p) => {
      acc[p.method] = (acc[p.method] || 0) + p.amount;
      return acc;
    }, {});

    return NextResponse.json({
      invoice: {
        id: invoice.id,
        number: invoice.invoiceNumber,
        total: invoice.total,
        status: invoice.status
      },
      payments,
      summary: {
        totalPaid,
        remainingBalance,
        isFullyPaid: totalPaid >= invoice.total,
        byMethod
      }
    });
  } catch (error) {
    console.error('GET /api/invoices/[id]/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch payments' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();
    const { amount, method, chequeNumber, bankName, paymentDate, notes } = body;

    if (!amount || amount <= 0) {
      return NextResponse.json(
        { error: 'Valid amount is required' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: { payments: true }
    });

    if (!invoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const payment = await prisma.payment.create({
      data: {
        invoiceId: id,
        amount,
        method: method || 'CASH',
        chequeNumber,
        bankName,
        paymentDate: paymentDate ? new Date(paymentDate) : new Date(),
        notes
      }
    });

    const allPayments = await prisma.payment.findMany({
      where: { invoiceId: id }
    });

    const totalPaid = allPayments.reduce((sum, p) => sum + p.amount, 0);

    let updatedInvoice = null;
    if (totalPaid >= invoice.total && invoice.status !== 'PAID') {
      updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: { status: 'PAID' }
      });
    }

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

    return NextResponse.json({ 
      success: true, 
      payment,
      invoice: updatedInvoice || invoice,
      summary: {
        totalPaid,
        remainingBalance: Math.max(invoice.total - totalPaid, 0),
        isFullyPaid: totalPaid >= invoice.total
      }
    }, { status: 201 });
  } catch (error) {
    console.error('POST /api/invoices/[id]/payments error:', error);
    return NextResponse.json(
      { error: 'Failed to create payment' },
      { status: 500 }
    );
  }
}