// app/api/auth/login/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { setSessionCookie } from '@/src/lib/auth';
import bcrypt from 'bcryptjs';

async function logAudit(data: {
  action: string; entityType: string; entityId?: string;
  userId?: string; description?: string; ipAddress?: string;
}) {
  try {
    await prisma.auditLog.create({
      data: {
        action:      data.action,
        entityType:  data.entityType,
        entityId:    data.entityId    ?? null,
        userId:      data.userId      ?? null,
        description: data.description ?? null,
        ipAddress:   data.ipAddress   ?? null,
      },
    });
  } catch {}
}

export async function POST(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';

  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } });

    if (!user || !user.isActive) {
      await logAudit({
        action: 'AUTH_LOGIN_FAILED', entityType: 'USER',
        description: `Failed login attempt for email: ${email}`,
        ipAddress: ip,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) {
      await logAudit({
        action: 'AUTH_LOGIN_FAILED', entityType: 'USER', entityId: user.id,
        description: `Wrong password for user: ${user.email}`,
        ipAddress: ip,
      });
      return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
    }

    await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });

    // Parse permissions stored as JSON string in DB, fallback to empty array
    let permissions: string[] = [];
    try {
      permissions = JSON.parse((user as any).permissions ?? '[]');
    } catch {
      permissions = [];
    }

    // Store permissions alongside role in session cookie
    await setSessionCookie({
      id:          user.id,
      name:        user.name,
      email:       user.email,
      role:        user.role,
      permissions,
    });

    await logAudit({
      action: 'AUTH_LOGIN', entityType: 'USER', entityId: user.id,
      userId: user.id,
      description: `${user.name} (${user.email}) logged in`,
      ipAddress: ip,
    });

    return NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
    });
  } catch (error: any) {
    console.error('Login error:', error);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
