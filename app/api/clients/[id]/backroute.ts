// app/api/clients/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma';

// GET /api/clients/[id] - Get single client
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const client = await prisma.client.findUnique({
      where: { id: params.id },
      include: {
        invoices: {
          include: {
            items: true,
            payments: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    })
    
    if (!client) {
      return NextResponse.json(
        { error: 'Client not found' },
        { status: 404 }
      )
    }
    
    return NextResponse.json(client)
  } catch (error) {
    console.error('Error fetching client:', error)
    return NextResponse.json(
      { error: 'Failed to fetch client' },
      { status: 500 }
    )
  }
}

// PUT /api/clients/[id] - Update client
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    
    if (!body.name?.trim()) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 }
      )
    }
    
    const client = await prisma.client.update({
      where: { id: params.id },
      data: {
        name: body.name,
        email: body.email,
        phone: body.phone,
        address: body.address,
        company: body.company,
        type: body.type || 'INDIVIDUAL',
        creditLimit: body.creditLimit ? parseFloat(body.creditLimit) : 0,
      }
    })
    
    return NextResponse.json(client)
  } catch (error) {
    console.error('Error updating client:', error)
    return NextResponse.json(
      { error: 'Failed to update client' },
      { status: 500 }
    )
  }
}

// DELETE /api/clients/[id] - Delete client
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Check if client has invoices
    const invoices = await prisma.invoice.count({
      where: { clientId: params.id }
    })
    
    if (invoices > 0) {
      return NextResponse.json(
        { error: 'Cannot delete client with existing invoices' },
        { status: 400 }
      )
    }
    
    await prisma.client.delete({
      where: { id: params.id }
    })
    
    return NextResponse.json({ message: 'Client deleted successfully' })
  } catch (error) {
    console.error('Error deleting client:', error)
    return NextResponse.json(
      { error: 'Failed to delete client' },
      { status: 500 }
    )
  }
}