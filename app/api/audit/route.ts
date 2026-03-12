
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { searchParams } = new URL(request.url);
    const search     = searchParams.get('search')     || '';
    const entityType = searchParams.get('entityType') || '';
    const action     = searchParams.get('action')     || '';
    const page       = parseInt(searchParams.get('page')  || '1');
    const limit      = parseInt(searchParams.get('limit') || '50');
    const skip       = (page - 1) * limit;

    const where: any = {};
    if (search)     where.description = { contains: search };
    if (entityType) where.entityType  = entityType;
    if (action)     where.action      = { contains: action };

    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        where,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip, take: limit,
      }),
      prisma.auditLog.count({ where }),
    ]);

    return NextResponse.json({
      logs,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch audit logs', details: error.message }, { status: 500 });
  }
}
