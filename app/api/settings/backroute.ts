// app/api/settings/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';

const DEFAULTS: Record<string, string> = {
  companyName:     'GloriousPharma',
  currency:        'ZMW',
  taxRate:         '0',
  invoicePrefix:   'INV',
  lowStockDefault: '10',
  timezone:        'Africa/Lusaka',
  logoUrl:         '',
};

export async function GET() {
  try {
    const rows = await prisma.setting.findMany();
    const result: Record<string, string> = { ...DEFAULTS };
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return NextResponse.json({ success: true, settings: result });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to load settings' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // Upsert each key
    for (const [key, value] of Object.entries(body)) {
      await prisma.setting.upsert({
        where:  { key },
        update: { value: String(value) },
        create: { key,  value: String(value) },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to save settings' }, { status: 500 });
  }
}
