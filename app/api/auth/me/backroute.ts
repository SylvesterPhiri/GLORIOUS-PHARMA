// app/api/auth/me/route.ts
import { NextResponse } from 'next/server';
import { getSession } from '@/src/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ user: null }, { status: 401 });
    return NextResponse.json({
      user: { id: session.id, name: session.name, email: session.email, role: session.role },
    });
  } catch {
    return NextResponse.json({ user: null }, { status: 500 });
  }
}
