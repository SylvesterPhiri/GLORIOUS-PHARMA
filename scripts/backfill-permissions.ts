// scripts/backfill-permissions.ts
// Run once with: npx ts-node scripts/backfill-permissions.ts
// OR: npx tsx scripts/backfill-permissions.ts

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const DEFAULT_PERMS_BY_ROLE: Record<string, string[]> = {
  SUPER_ADMIN: ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','users.manage','settings.view','settings.edit','audit.view','returns.view','returns.process'],
  ADMIN:       ['invoices.view','invoices.create','invoices.edit','invoices.delete','clients.view','clients.create','clients.edit','clients.delete','inventory.view','inventory.create','inventory.edit','inventory.delete','manufacturers.view','manufacturers.edit','reports.view','accounting.view','accounting.edit','users.view','returns.view','returns.process'],
  PHARMACIST:  ['invoices.view','invoices.create','inventory.view','clients.view','returns.view','returns.process'],
  SALES_REP:   ['invoices.view','invoices.create','clients.view','clients.create','clients.edit','inventory.view','returns.view'],
  ACCOUNTANT:  ['invoices.view','accounting.view','accounting.edit','reports.view','audit.view','returns.view'],
};

async function main() {
  const users = await prisma.user.findMany();
  let updated = 0;

  for (const user of users) {
    const currentPerms = JSON.parse((user as any).permissions ?? '[]');

    // Only backfill if permissions are empty
    if (currentPerms.length === 0) {
      const defaultPerms = DEFAULT_PERMS_BY_ROLE[user.role] ?? [];
      await prisma.user.update({
        where: { id: user.id },
        data:  { permissions: JSON.stringify(defaultPerms) } as any,
      });
      console.log(`✓ ${user.name} (${user.role}) → ${defaultPerms.length} permissions assigned`);
      updated++;
    } else {
      console.log(`- ${user.name} (${user.role}) → already has ${currentPerms.length} permissions, skipped`);
    }
  }

  console.log(`\nDone. ${updated} user(s) updated.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); prisma.$disconnect(); process.exit(1); });
