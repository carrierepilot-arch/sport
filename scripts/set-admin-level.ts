import { prisma } from '../lib/prisma';

async function main() {
  const email = process.argv[2];
  const level = Number(process.argv[3] ?? 3);
  if (!email) {
    throw new Error('Usage: tsx scripts/set-admin-level.ts <email> [level]');
  }

  const adminLevel = Math.max(0, Math.min(3, Math.trunc(level)));
  const updated = await prisma.user.update({
    where: { email },
    data: {
      isAdmin: adminLevel > 0,
      adminLevel,
    },
    select: { id: true, email: true, isAdmin: true, adminLevel: true },
  });

  console.log(JSON.stringify(updated));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
