// app/api/settings/logo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

async function logAudit(data: { action: string; entityType: string; userId?: string; description?: string; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: null, userId: data.userId ?? null, description: data.description ?? null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

export async function POST(request: NextRequest) {
  try {
    const session  = await getSession();
    const formData = await request.formData();
    const file     = formData.get('logo') as File | null;

    if (!file)                           return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    if (!file.type.startsWith('image/')) return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    if (file.size > 2 * 1024 * 1024)    return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 });

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const base64 = buffer.toString('base64');
    const logoUrl = `data:${file.type};base64,${base64}`;

    await prisma.setting.upsert({ where: { key: 'logoUrl' }, update: { value: logoUrl }, create: { key: 'logoUrl', value: logoUrl } });

    await logAudit({
      action: 'SETTINGS_UPDATED', entityType: 'SETTINGS', userId: session?.id,
      description: `Company logo uploaded by ${session?.name ?? 'unknown'}`,
      newData: { logoUrl: 'base64_image' },
    });

    return NextResponse.json({ success: true, logoUrl });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
