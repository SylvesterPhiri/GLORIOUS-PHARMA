import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

interface Params {
  params: {
    id: string;
  };
}

export async function GET(request: NextRequest, { params }: Params) {
  try {
    const manufacturer = await prisma.manufacturer.findUnique({
      where: { id: params.id },
    });

    if (!manufacturer) {
      return NextResponse.json(
        { error: 'Manufacturer not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(manufacturer);
  } catch (error) {
    console.error('Error fetching manufacturer:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manufacturer' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest, { params }: Params) {
  try {
    const data = await request.json();
    
    const updatedManufacturer = await prisma.manufacturer.update({
      where: { id: params.id },
      data,
    });

    return NextResponse.json(updatedManufacturer);
  } catch (error) {
    console.error('Error updating manufacturer:', error);
    return NextResponse.json(
      { error: 'Failed to update manufacturer' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  try {
    await prisma.manufacturer.delete({
      where: { id: params.id },
    });

    return NextResponse.json({ message: 'Manufacturer deleted' });
  } catch (error) {
    console.error('Error deleting manufacturer:', error);
    return NextResponse.json(
      { error: 'Failed to delete manufacturer' },
      { status: 500 }
    );
  }
}