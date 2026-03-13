
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { getSession } from '@/src/lib/auth';

const DEFAULTS: Record<string, string> = {
  companyName: 'GloriousPharma', currency: 'ZMW', taxRate: '0',
  invoicePrefix: 'INV', lowStockDefault: '10', timezone: 'Africa/Lusaka', logoUrl: '',
};

async function logAudit(data: { action: string; entityType: string; userId?: string; description?: string; oldData?: any; newData?: any }) {
  try { await prisma.auditLog.create({ data: { action: data.action, entityType: data.entityType, entityId: null, userId: data.userId ?? null, description: data.description ?? null, oldData: data.oldData ? JSON.stringify(data.oldData) : null, newData: data.newData ? JSON.stringify(data.newData) : null } }); } catch {}
}

export async function GET() {
  try {
    const rows   = await prisma.setting.findMany();
    const result = { ...DEFAULTS };
    for (const row of rows) result[row.key] = row.value;
    return NextResponse.json({ success: true, settings: result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    const body    = await request.json();

    const oldRows   = await prisma.setting.findMany();
    const oldValues: Record<string, string> = { ...DEFAULTS };
    for (const row of oldRows) oldValues[row.key] = row.value;

    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({ where: { key }, update: { value: String(value) }, create: { key, value: String(value) } });
    }

    await logAudit({
      action: 'SETTINGS_UPDATED', entityType: 'SETTINGS', userId: session?.id,
      description: `System settings updated by ${session?.name ?? 'unknown'}`,
      oldData: oldValues, newData: body,
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}