import { prisma } from '../lib/prisma';

async function main() {
  const rows = await prisma.exerciseTranslation.findMany({
    where: { sourceApi: 'muscle-up-pdf' },
    orderBy: { translatedName: 'asc' },
    select: {
      sourceName: true,
      translatedName: true,
      gifUrl: true,
      category: true,
      metadata: true,
    },
  });

  console.log(JSON.stringify(rows, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });