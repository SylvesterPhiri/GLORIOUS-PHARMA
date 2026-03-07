// app/api/settings/logo/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/src/lib/prisma';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get('logo') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 });
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Image must be under 2MB' }, { status: 400 });
    }

    const bytes  = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Save to public/uploads/
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const ext      = file.name.split('.').pop() ?? 'png';
    const filename = `logo.${ext}`;
    const filepath = join(uploadDir, filename);
    await writeFile(filepath, buffer);

    const logoUrl = `/uploads/${filename}`;

    // Save URL to settings
    await prisma.setting.upsert({
      where:  { key: 'logoUrl' },
      update: { value: logoUrl },
      create: { key: 'logoUrl', value: logoUrl },
    });

    return NextResponse.json({ success: true, logoUrl });
  } catch (error: any) {
    console.error('Logo upload error:', error);
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
