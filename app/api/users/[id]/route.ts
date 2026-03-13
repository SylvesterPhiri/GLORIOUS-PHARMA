
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';
import bcrypt from 'bcryptjs';

const DEFAULT_PERMS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','users.manage','settings.view','settings.edit','audit.view','returns.view','returns.process'],
  ADMIN:       ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','returns.view','returns.process'],
  PHARMACIST:  ['invoices.view','invoices.create','inventory.view','clients.view','returns.view','returns.process'],
  SALES_REP:   ['invoices.view','invoices.create','clients.view','clients.create','clients.edit','inventory.view','returns.view'],
  ACCOUNTANT:  ['invoices.view','accounting.view','accounting.edit','reports.view','audit.view','returns.view'],
};

async function logAudit(data: { action: string; entityType: string; entityId?: string; userId?: string; description?: string; oldData?: any; newData?: any; changes?: any }) {
  try {
    await prisma.auditLog.create({
      data: {
        action:      data.action,
        entityType:  data.entityType,
        entityId:    data.entityId  ?? null,
        userId:      data.userId    ?? null,
        description: data.description ?? null,
        oldData:     data.oldData  ? JSON.stringify(data.oldData)  : null,
        newData:     data.newData  ? JSON.stringify(data.newData)  : null,
        changes:     data.changes  ? JSON.stringify(data.changes)  : null,
      },
    });
  } catch {}
}

interface RouteParams { params: { id: string } }

export async function PUT(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { id }   = params;
    const body     = await request.json();
    const existing = await prisma.user.findUnique({ where: { id } });
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    const updateData: any = {};

    if (body.name)     updateData.name  = body.name.trim();
    if (body.email)    updateData.email = body.email.toLowerCase().trim();
    if (body.password) updateData.password = await bcrypt.hash(body.password, 12);

    if (body.role && body.role !== existing.role) {
      updateData.role = body.role;
      if (!body.permissions) {
        updateData.permissions = JSON.stringify(DEFAULT_PERMS_BY_ROLE[body.role] ?? []);
      }
    }

    if (body.permissions !== undefined) {
      updateData.permissions = JSON.stringify(body.permissions);
    }

    const user = await prisma.user.update({
      where: { id },
      data:  updateData,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, permissions: true },
    });

    const changes: Record<string, { from: any; to: any }> = {};
    if (body.name        && (existing as any).name  !== user.name)  changes.name  = { from: (existing as any).name,  to: user.name };
    if (body.email       && (existing as any).email !== user.email) changes.email = { from: (existing as any).email, to: user.email };
    if (body.role        && (existing as any).role  !== user.role)  changes.role  = { from: (existing as any).role,  to: user.role };
    if (body.password)                                               changes.password    = { from: '[hidden]', to: '[changed]' };
    if (body.permissions !== undefined)                              changes.permissions = { from: '[previous]', to: `${body.permissions.length} permissions` };

    await logAudit({
      action: 'USER_UPDATED', entityType: 'USER', entityId: id, userId: session.id,
      description: `User "${user.name}" updated by ${session.name}`,
      oldData: { name: (existing as any).name, email: (existing as any).email, role: (existing as any).role },
      newData: { name: user.name, email: user.email, role: user.role },
      changes,
    });

    return NextResponse.json({ success: true, user });
  } catch (error: any) {
    console.error('PUT /api/users/[id] error:', error);
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    if (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')
      return NextResponse.json({ error: 'Insufficient permissions' }, { status: 403 });

    const { id } = params;
    if (id === session.id)
      return NextResponse.json({ error: 'You cannot deactivate your own account' }, { status: 400 });

    const existing = await prisma.user.findUnique({ where: { id }, select: { name: true, email: true, role: true } });
    if (!existing) return NextResponse.json({ error: 'User not found' }, { status: 404 });

    await prisma.user.update({ where: { id }, data: { isActive: false } });

    await logAudit({
      action: 'USER_DEACTIVATED', entityType: 'USER', entityId: id, userId: session.id,
      description: `User "${existing.name}" (${existing.email}) deactivated by ${session.name}`,
      oldData: { name: existing.name, email: existing.email, role: existing.role, isActive: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 });
  }
}