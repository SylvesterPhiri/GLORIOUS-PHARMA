// app/api/manufacturers/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

// GET /api/manufacturers
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const search = searchParams.get('search');
    
    const where: any = {};
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { contactPerson: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search } },
        { motherCompany: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    const manufacturers = await prisma.manufacturer.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(manufacturers);
  } catch (error) {
    console.error('Error fetching manufacturers:', error);
    return NextResponse.json(
      { error: 'Failed to fetch manufacturers' },
      { status: 500 }
    );
  }
}

// POST /api/manufacturers
export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.name) {
      return NextResponse.json(
        { error: 'Manufacturer name is required' },
        { status: 400 }
      );
    }

    // Convert empty strings to null
    const manufacturerData = {
      name: data.name,
      contactPerson: data.contactPerson && data.contactPerson.trim() !== '' ? data.contactPerson : null,
      phone: data.phone && data.phone.trim() !== '' ? data.phone : null,
      email: data.email && data.email.trim() !== '' ? data.email : null,
      motherCompany: data.motherCompany && data.motherCompany.trim() !== '' ? data.motherCompany : null,
      address: data.address && data.address.trim() !== '' ? data.address : null,
      location: data.location && data.location.trim() !== '' ? data.location : null,
    };
    
    const manufacturer = await prisma.manufacturer.create({
      data: manufacturerData
    });
    
    return NextResponse.json(manufacturer, { status: 201 });
  } catch (error: any) {
    console.error('Error creating manufacturer:', error);
    
    return NextResponse.json(
      { error: 'Failed to create manufacturer' },
      { status: 500 }
    );
  }
}
