import * as prismaClientModule from '../lib/generated/prisma/client.ts';

const { PrismaClient } = prismaClientModule;

const prisma = new PrismaClient();

try {
  const rows = await prisma.exerciseTranslation.findMany({
    where: { sourceApi: 'muscle-up-pdf' },
    orderBy: { translatedName: 'asc' },
  });

  console.log(JSON.stringify(rows.map((row) => ({
    sourceName: row.sourceName,
    translatedName: row.translatedName,
    gifUrl: row.gifUrl,
    category: row.category,
  })), null, 2));
} finally {
  await prisma.$disconnect();
}