import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const skip = (page - 1) * limit;

    const where = search ? {
      OR: [
        { name: { contains: search, mode: 'insensitive' as const } },
        { genericName: { contains: search, mode: 'insensitive' as const } },
        { batchNumber: { contains: search, mode: 'insensitive' as const } },
      ],
    } : {};

    const [products, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: {
          manufacturer: {
            select: {
              name: true,
              motherCompany: true,
            },
          },
        },
        orderBy: { name: 'asc' },
        skip,
        take: limit,
      }),
      prisma.product.count({ where }),
    ]);

    // Calculate stock status
    const productsWithStatus = products.map(product => ({
      ...product,
      stockStatus: product.currentStock <= product.minStock ? 'LOW' : 'GOOD',
      isExpired: new Date(product.expiryDate) < new Date(),
      isExpiringSoon: new Date(product.expiryDate) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    }));

    // Create response with cache-control headers to prevent caching
    const response = NextResponse.json({
      products: productsWithStatus,
      pagination: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
      },
    });

    // Add headers to prevent caching
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');

    return response;
  } catch (error: any) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products', details: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json();

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

    // Create product data - REMOVED reorderLevel
    const productData = {
      name: data.name.trim(),
      genericName: data.genericName?.trim() || null,
      type: data.type || 'TABLET',
      category: data.category?.trim() || null,
      manufacturerId: data.manufacturerId,
      batchNumber: data.batchNumber.trim(),
      expiryDate: new Date(data.expiryDate),
      unit: data.unit || 'pack',
      price: parseFloat(data.price) || 0,
      initialStock: parseInt(data.initialStock) || 0,
      currentStock: parseInt(data.initialStock) || 0,
      minStock: parseInt(data.minStock) || 10,
    };

    const product = await prisma.product.create({
      data: productData,
      include: {
        manufacturer: true,
      },
    });

    const response = NextResponse.json(product, { status: 201 });
    response.headers.set('Cache-Control', 'no-store, max-age=0');
    
    return response;
  } catch (error: any) {
    console.error('Error creating product:', error);
    
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
    
    return NextResponse.json(
      { error: 'Failed to create product', details: error.message },
      { status: 500 }
    );
  }
}
