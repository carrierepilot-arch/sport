import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '../lib/prisma';

type ScrapedExercise = {
  name: string;
  slug: string;
  categories: string[];
  sourceUrls: string[];
  sourceCount: number;
  qualityScore?: number;
};

type ScrapedPayload = {
  generatedAt?: string;
  summary?: { uniqueExercises?: number };
  exercises?: ScrapedExercise[];
};

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);

const minSources = Number(args['min-sources'] || 2);
const minQuality = Number(args['min-quality'] || 5);
const inputPath = args['input']
  ? path.resolve(String(args['input']))
  : path.resolve(process.cwd(), 'scripts', 'output', 'exercises-scraped.json');
const replaceExisting = String(args['replace'] || 'false') === 'true';

const IMPORT_NOISE_RE = /(workout|exercise(s)?|guide|tips|program|article|news|review|membership|calculator|about|contact|privacy|policy|store|shop|account|login)/i;

function compactText(value: string, max = 1000): string {
  const v = value.replace(/\s+/g, ' ').trim();
  return v.length <= max ? v : v.slice(0, max);
}

async function main() {
  console.log(`[import] Loading file: ${inputPath}`);
  const raw = await fs.readFile(inputPath, 'utf8');
  const payload = JSON.parse(raw) as ScrapedPayload;
  const all = payload.exercises ?? [];

  if (all.length === 0) {
    console.log('[import] No exercises found in payload.');
    return;
  }

  const filtered = all.filter((item) => {
    if (!item.name || !item.slug) return false;
    if (item.sourceCount < minSources) return false;
    if ((item.qualityScore ?? 0) < minQuality) return false;
    if (IMPORT_NOISE_RE.test(item.name)) return false;
    const wc = item.name.split(/\s+/).filter(Boolean).length;
    if (wc > 5) return false;
    return true;
  });
  console.log(`[import] Raw: ${all.length} | sourceCount>=${minSources} & quality>=${minQuality}: ${filtered.length}`);

  if (replaceExisting) {
    const deleted = await prisma.exerciseTranslation.deleteMany({ where: { sourceApi: 'web-scrape' } });
    console.log(`[import] Deleted old web-scrape rows: ${deleted.count}`);
  }

  let upserted = 0;
  for (const item of filtered) {
    const description = compactText(
      `Categories: ${item.categories.join(', ')} | Sources: ${item.sourceCount} | Quality: ${item.qualityScore ?? 0}`,
      400,
    );

    await prisma.exerciseTranslation.upsert({
      where: { sourceName: item.slug },
      update: {
        translatedName: compactText(item.name, 120),
        translatedDescription: description,
        instructionsFr: null,
        sourceApi: 'web-scrape',
      },
      create: {
        sourceName: item.slug,
        translatedName: compactText(item.name, 120),
        translatedDescription: description,
        instructionsFr: null,
        sourceApi: 'web-scrape',
      },
    });

    upserted++;
  }

  console.log(`[import] Upserted rows: ${upserted}`);
}

main()
  .catch((error) => {
    console.error('[import] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
