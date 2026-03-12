
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/src/lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search') || ''
    const type = searchParams.get('type')

    const where: any = {}
    
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
      ]
    }
    
    if (type && type !== 'all') {
      where.type = type
    }

    const clients = await prisma.client.findMany({
      where,
      orderBy: { createdAt: 'desc' }
    })

    return NextResponse.json(clients)
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch clients' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const data = await request.json()
    
    if (!data.name?.trim()) {
      return NextResponse.json(
        { error: 'Client name is required' },
        { status: 400 }
      )
    }

    const client = await prisma.client.create({
      data: {
        name: data.name,
        email: data.email,
        phone: data.phone,
        address: data.address,
        company: data.company,
        type: data.type || 'INDIVIDUAL',
        creditLimit: data.creditLimit ? parseFloat(data.creditLimit) : 0,
      }
    })

    return NextResponse.json(client, { status: 201 })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json(
      { error: 'Failed to create client' },
      { status: 500 }
    )
  }
}
