import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

interface ReturnItem {
  productId: string;
  quantity: number;
  reason?: string;
}

export async function POST(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const body = await request.json();
    const { items }: { items: ReturnItem[] } = body;

    console.log('Processing return for invoice:', id);
    console.log('Return items:', items);

    if (!items || items.length === 0) {
      return NextResponse.json(
        { error: 'No items provided for return' },
        { status: 400 }
      );
    }

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: { include: { product: true } },
        client: true,
      },
    });

    if (!invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Validate return items against invoice items
    for (const returnItem of items) {
      const invoiceItem = invoice.items.find(
        (item) => item.productId === returnItem.productId
      );

      if (!invoiceItem) {
        return NextResponse.json(
          { error: `Product ${returnItem.productId} not found in invoice` },
          { status: 400 }
        );
      }

      if (returnItem.quantity > invoiceItem.quantity) {
        return NextResponse.json(
          {
            error: `Cannot return more than ${invoiceItem.quantity} units of ${invoiceItem.product.name}`,
          },
          { status: 400 }
        );
      }

      if (returnItem.quantity <= 0) {
        return NextResponse.json(
          { error: 'Return quantity must be greater than 0' },
          { status: 400 }
        );
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const returns = [];

      for (const returnItem of items) {
        const returnRecord = await tx.return.create({
          data: {
            invoiceId: id,
            productId: returnItem.productId,
            quantity: returnItem.quantity,
            reason: returnItem.reason || 'No reason provided', // ✅ reason is required in schema
          },
        });

        await tx.product.update({
          where: { id: returnItem.productId },
          data: {
            currentStock: { increment: returnItem.quantity },
          },
        });

        returns.push(returnRecord);
      }

      const returnAmount = items.reduce((sum, item) => {
        const invoiceItem = invoice.items.find((i) => i.productId === item.productId);
        return sum + (invoiceItem?.unitPrice || 0) * item.quantity;
      }, 0);

      // ✅ Use `total` not `totalAmount` — matches the schema field name
      const newTotal = Math.max(invoice.total - returnAmount, 0);

      await tx.invoice.update({
        where: { id },
        data: {
          total: newTotal,
          hasReturns: true,   // ✅ mark the invoice as having returns
        },
      });

      return { returns, returnAmount, newTotal };
    });

    console.log('Returns processed successfully:', result);

    return NextResponse.json({
      success: true,
      message: 'Return processed successfully',
      returns: result.returns,
      returnAmount: result.returnAmount,
      newInvoiceTotal: result.newTotal,
    });
  } catch (error: any) {
    console.error('Error processing return:', error);
    return NextResponse.json(
      { error: 'Failed to process return', details: error.message },
      { status: 500 }
    );
  }
}
