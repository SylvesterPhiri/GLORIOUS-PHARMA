
import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, getSession } from '@/src/lib/auth';
import { prisma } from '@/src/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();

    if (session) {
      await prisma.auditLog.create({
        data: {
          action:      'AUTH_LOGOUT',
          entityType:  'USER',
          entityId:    session.id,
          userId:      session.id,
          description: `${session.name} (${session.email}) logged out`,
        },
      }).catch(() => {});
    }
  } catch {}

  await clearSessionCookie();
  return NextResponse.json({ success: true });
}