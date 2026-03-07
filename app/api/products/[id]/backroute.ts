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

    console.log('Fetching product with ID:', id);

    const product = await prisma.product.findUnique({
      where: { id },
      include: {
        manufacturer: {
          select: {
            id: true,
            name: true,
            motherCompany: true,
          },
        },
      },
    });

    if (!product) {
      console.log('Product not found:', id);
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Calculate stock status
    const productWithStatus = {
      ...product,
      stockStatus: product.currentStock <= product.minStock ? 'LOW' : 'GOOD',
      isExpired: new Date(product.expiryDate) < new Date(),
      isExpiringSoon: new Date(product.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    };

    const response = NextResponse.json(productWithStatus);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error fetching product:', error);
    return NextResponse.json(
      { error: 'Failed to fetch product', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params;
    const data = await request.json();
    
    console.log('Update request for product:', id);
    console.log('Update data:', data);
    
    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Validate required fields
    if (!data.name || !data.name.trim()) {
      return NextResponse.json(
        { error: 'Product name is required' },
        { status: 400 }
      );
    }

    if (!data.manufacturerId) {
      return NextResponse.json(
        { error: 'Manufacturer is required' },
        { status: 400 }
      );
    }

    if (!data.batchNumber || !data.batchNumber.trim()) {
      return NextResponse.json(
        { error: 'Batch number is required' },
        { status: 400 }
      );
    }

    if (!data.expiryDate) {
      return NextResponse.json(
        { error: 'Expiry date is required' },
        { status: 400 }
      );
    }

    // Prepare update data - REMOVED reorderLevel
    const updateData: any = {
      name: data.name.trim(),
      genericName: data.genericName?.trim() || null,
      type: data.type || existingProduct.type,
      category: data.category?.trim() || null,
      unit: data.unit || existingProduct.unit,
      price: data.price !== undefined ? parseFloat(data.price) : existingProduct.price,
      currentStock: data.currentStock !== undefined ? parseInt(data.currentStock) : existingProduct.currentStock,
      minStock: data.minStock !== undefined ? parseInt(data.minStock) : existingProduct.minStock,
      manufacturerId: data.manufacturerId,
      batchNumber: data.batchNumber.trim(),
      expiryDate: new Date(data.expiryDate),
    };

    // Validate numeric fields
    if (updateData.price < 0) {
      return NextResponse.json(
        { error: 'Price cannot be negative' },
        { status: 400 }
      );
    }

    if (updateData.currentStock < 0) {
      return NextResponse.json(
        { error: 'Current stock cannot be negative' },
        { status: 400 }
      );
    }

    if (updateData.minStock < 0) {
      return NextResponse.json(
        { error: 'Minimum stock cannot be negative' },
        { status: 400 }
      );
    }

    console.log('Final update data:', updateData);

    const updatedProduct = await prisma.product.update({
      where: { id },
      data: updateData,
      include: {
        manufacturer: {
          select: {
            id: true,
            name: true,
            motherCompany: true,
          },
        },
      },
    });

    console.log('Product updated successfully:', updatedProduct.id);

    const response = NextResponse.json(updatedProduct);
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error updating product:', error);
    
    // Handle Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json(
        { error: 'A product with this name already exists' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'Invalid manufacturer ID' },
        { status: 400 }
      );
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { 
        error: 'Failed to update product',
        details: error.message,
        code: error.code
      },
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

    console.log('Delete request for product:', id);

    // Check if product exists
    const existingProduct = await prisma.product.findUnique({
      where: { id }
    });

    if (!existingProduct) {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }

    // Check if product is used in any invoices
    const invoiceItems = await prisma.invoiceItem.count({
      where: { productId: id },
    });

    if (invoiceItems > 0) {
      return NextResponse.json(
        { error: 'Cannot delete product that is used in invoices' },
        { status: 400 }
      );
    }

    // Delete the product
    await prisma.product.delete({
      where: { id },
    });

    console.log('Product deleted successfully:', id);

    const response = NextResponse.json({ 
      success: true,
      message: 'Product deleted successfully' 
    });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error deleting product:', error);
    
    if (error.code === 'P2025') {
      return NextResponse.json(
        { error: 'Product not found' },
        { status: 404 }
      );
    }
    
    return NextResponse.json(
      { error: 'Failed to delete product', details: error.message },
      { status: 500 }
    );
  }
}
