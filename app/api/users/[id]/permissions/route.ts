// app/api/users/[id]/permissions/route.ts
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
    
    const user = await prisma.user.findUnique({
      where: { id },
      select: { permissions: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse permissions from JSON string (they're stored as JSON string in your schema)
    const permissions = user.permissions ? JSON.parse(user.permissions) : [];
    
    return NextResponse.json({ permissions, role: user.role });
  } catch (error: any) {
    console.error('GET /api/users/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Failed to fetch permissions' }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    // Only SUPER_ADMIN and ADMIN can change permissions
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });
    }

    const { id } = params;
    const { permissions } = await request.json();

    const user = await prisma.user.findUnique({
      where: { id }
    });

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update permissions (store as JSON string)
    const updatedUser = await prisma.user.update({
      where: { id },
      data: {
        permissions: JSON.stringify(permissions)
      },
      select: { id: true, name: true, email: true, role: true, permissions: true }
    });

    // Log the permission change
    await logAudit({
      action: 'PERMISSIONS_UPDATED',
      entityType: 'USER',
      entityId: id,
      userId: session.id,
      description: `Permissions updated for user "${user.name}" by ${session.name}`,
      changes: { permissions: { from: user.permissions, to: JSON.stringify(permissions) } }
    });

    return NextResponse.json({ 
      success: true, 
      permissions: JSON.parse(updatedUser.permissions || '[]') 
    });
  } catch (error: any) {
    console.error('PUT /api/users/[id]/permissions error:', error);
    return NextResponse.json({ error: 'Failed to update permissions' }, { status: 500 });
  }
}

// Helper function for audit logging (copy from your existing code)
async function logAudit(data: any) {
  try {
    await prisma.auditLog.create({
      data: {
        action: data.action,
        entityType: data.entityType,
        entityId: data.entityId ?? null,
        userId: data.userId ?? null,
        description: data.description ?? null,
        changes: data.changes ? JSON.stringify(data.changes) : null,
      },
    });
  } catch {}
}