

import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { getSession } from '@/src/lib/auth';

export async function GET() {
  try {
    const session = await getSession();
    if (!session || (session.role !== 'SUPER_ADMIN' && session.role !== 'ADMIN')) {
      return NextResponse.json({ error: 'Only admins can download backups' }, { status: 403 });
    }

    const dbPath = join(process.cwd(), 'prisma', 'dev.db');
    const buffer = await readFile(dbPath);

    const date     = new Date().toISOString().split('T')[0];
    const filename = `glorious-backup-${date}.db`;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':        'application/octet-stream',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length':      String(buffer.length),
      },
    });
  } catch (error: any) {
    console.error('Backup error:', error);
    return NextResponse.json({ error: 'Failed to create backup: ' + error.message }, { status: 500 });
  }
}
