// app/api/users/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';
import bcrypt from 'bcryptjs';

// Default permissions per role — assigned automatically on user creation
const DEFAULT_PERMS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','users.manage','settings.view','settings.edit','audit.view','returns.view','returns.process'],
  ADMIN:       ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','returns.view','returns.process'],
  PHARMACIST:  ['invoices.view','invoices.create','inventory.view','clients.view','returns.view','returns.process'],
  SALES_REP:   ['invoices.view','invoices.create','clients.view','clients.create','clients.edit','inventory.view','returns.view'],
  ACCOUNTANT:  ['invoices.view','accounting.view','accounting.edit','reports.view','audit.view','returns.view'],
};

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; newData?: any }) {
  try {
    await prisma.auditLog.create({
      data: {
        action:      data.action,
        entityType:  data.entityType,
        entityId:    data.entityId    ?? null,
        userId:      data.userId      ?? null,
        description: data.description ?? null,
        newData:     data.newData ? JSON.stringify(data.newData) : null,
      },
    });
  } catch {}
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const users = await prisma.user.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, name: true, email: true, role: true, isActive: true, lastLoginAt: true, createdAt: true },
    });
    return NextResponse.json({ users });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

    const { name, email, password, role } = await request.json();
    if (!name || !email || !password)
      return NextResponse.json({ error: 'Name, email and password are required' }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
    if (existing) return NextResponse.json({ error: 'A user with this email already exists' }, { status: 409 });

    const hashed     = await bcrypt.hash(password, 12);
    const assignRole = role ?? 'PHARMACIST';

    // Automatically assign default permissions for the role
    const defaultPerms = DEFAULT_PERMS_BY_ROLE[assignRole] ?? [];

    const user = await prisma.user.create({
      data: {
        name:        name.trim(),
        email:       email.toLowerCase().trim(),
        password:    hashed,
        role:        assignRole,
        permissions: JSON.stringify(defaultPerms),  // ← assign defaults on creation
      },
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true },
    });

    await logAudit({
      action: 'USER_CREATED', entityType: 'USER', entityId: user.id, userId: session.id,
      description: `User "${user.name}" (${user.email}) created with role ${user.role} by ${session.name}`,
      newData: { name: user.name, email: user.email, role: user.role },
    });

    return NextResponse.json({ success: true, user }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/users error:', error);
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}
