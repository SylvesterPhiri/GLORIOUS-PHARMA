import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

interface RouteParams {
  params: {
    id: string;
  };
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;

    console.log('Fetching invoice with ID:', id);

    const invoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        client: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            address: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                genericName: true,
                type: true,
                unit: true,
              },
            },
          },
        },
        returns: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    if (!invoice) {
      console.log('Invoice not found:', id);
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    const response = NextResponse.json(invoice);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error fetching invoice:', error);
    return NextResponse.json(
      { error: 'Failed to fetch invoice', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;

    console.log('Delete request for invoice:', id);

    // Check if invoice exists
    const existingInvoice = await prisma.invoice.findUnique({
      where: { id },
      include: {
        items: true,
        returns: true,
      },
    });

    if (!existingInvoice) {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }

    // Check if there are any returns
    if (existingInvoice.returns && existingInvoice.returns.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete invoice with returns. Please delete returns first.' },
        { status: 400 }
      );
    }

    // Delete in transaction
    await prisma.$transaction(async (tx) => {
      // Delete invoice items first
      await tx.invoiceItem.deleteMany({
        where: { invoiceId: id },
      });

      // Delete the invoice
      await tx.invoice.delete({
        where: { id },
      });
    });

    console.log('Invoice deleted successfully:', id);

    const response = NextResponse.json({ 
      success: true,
      message: 'Invoice deleted successfully' 
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error deleting invoice:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Invoice not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete invoice', details: error.message },
      { status: 500 }
    );
  }
}
