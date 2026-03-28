import { prisma } from '../lib/prisma';

async function main() {
  const total = await prisma.spot.count({ where: { status: 'approved' } });
  const synthetic = await prisma.spot.count({ where: { status: 'approved', name: { startsWith: 'SW IDF ' } } });
  const noCity = await prisma.spot.count({ where: { status: 'approved', city: null } });
  console.log(JSON.stringify({ total, synthetic, noCity }, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
