import { PrismaClient } from '../lib/generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL ?? '' });
const prisma = new PrismaClient({ adapter });

async function main() {
  // DB total size
  const dbSize = await prisma.$queryRaw`SELECT pg_size_pretty(pg_database_size(current_database())) AS db_size`;

  // Dead tuples (bloat from mass deletions)
  const deadTuples = await prisma.$queryRaw`
    SELECT 
      relname AS table,
      n_live_tup AS live_rows,
      n_dead_tup AS dead_rows,
      pg_size_pretty(pg_total_relation_size(quote_ident(relname))) AS total_size,
      pg_total_relation_size(quote_ident(relname)) AS size_bytes
    FROM pg_stat_user_tables
    ORDER BY size_bytes DESC
  `;

  console.log('=== DB TOTAL SIZE ===');
  console.log(dbSize[0].db_size);

  console.log('\n=== TABLE DETAILS (live rows / dead rows / size) ===');
  for (const row of deadTuples) {
    const dead = Number(row.dead_rows);
    const live = Number(row.live_rows);
    const flag = dead > 1000 ? ' ⚠ BLOAT' : '';
    console.log(`  ${row.table.padEnd(30)} live=${String(live).padStart(7)}  dead=${String(dead).padStart(7)}  ${row.total_size}${flag}`);
  }

  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
