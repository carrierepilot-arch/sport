import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { PDFParse } from 'pdf-parse';
import { prisma } from '../lib/prisma';
import type { Prisma } from '../lib/generated/prisma/client';
import { normalizeExerciseName, toExerciseMediaSlug } from '../lib/exercise-media';
import { findBestNameMatch, listCatalogCandidates, scoreExerciseNameMatch } from '../lib/exercise-matching';

ffmpeg.setFfmpegPath(ffmpegPath as string);

type PdfExercise = {
  name: string;
  normalizedName: string;
  description: string;
  instructions: string;
  category: string | null;
  sourceApi: string;
  metadata: Record<string, unknown>;
  gifUrl: string | null;
};

const args = Object.fromEntries(
  process.argv.slice(2).filter((a) => a.startsWith('--')).map((a) => {
    const [k, v = 'true'] = a.replace(/^--/, '').split('=');
    return [k, v];
  }),
);

const PDF_PATH = path.resolve(String(args.input || 'C:/Users/Admin/Pictures/Muscul up.pdf'));
const GIF_SOURCE_DIR = path.resolve(String(args['gif-source-dir'] || 'C:/Users/Admin/Desktop/MuscleWiki_GIFs'));
const OUTPUT_DIR = path.resolve(String(args['output-dir'] || path.join(process.cwd(), 'public', 'exercise-media', 'generated')));
const TMP_DIR = path.join(os.tmpdir(), 'sport-muscle-up-import');
const SOURCE_API = String(args.source || 'muscle-up-pdf');
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';

type ExerciseDbEntry = {
  name?: string;
  gifUrl?: string;
  bodyPart?: string;
  target?: string;
  instructions?: string[];
};

function compactText(value: string, max = 4000): string {
  const v = value.replace(/\s+/g, ' ').trim();
  return v.length <= max ? v : v.slice(0, max);
}

function titleCaseFromSlug(value: string): string {
  return value.split('-').map((token) => token ? `${token[0].toUpperCase()}${token.slice(1)}` : token).join(' ');
}

function extractPrimaryCategories(text: string): string[] {
  const section = text.match(/Primary:\s*([\s\S]*?)EQUIPMENT/i)?.[1] ?? '';
  return section
    .split(/\n+/)
    .map((line) => line.replace(/[•▪✓]/g, '').trim())
    .filter(Boolean);
}

function extractEquipment(text: string): string[] {
  const section = text.match(/EQUIPMENT\s*([\s\S]*?)The muscle-up is/i)?.[1] ?? '';
  return section
    .split(/\n+/)
    .map((line) => line.replace(/[•▪✓]/g, '').trim())
    .filter(Boolean);
}

function extractMainTitle(text: string): string {
  const match = text.match(/^\s*([A-Z][A-Z\- ]{3,})\s*$/m);
  return (match?.[1] || 'MUSCLE-UP').trim();
}

function extractHowToSection(text: string): string {
  const match = text.match(/Here are the general steps to perform a muscle-up:([\s\S]*?)Here’s a comprehensive guide/i);
  return compactText(match?.[1] ?? '', 2500);
}

function extractGuideSection(text: string): string {
  const match = text.match(/Here’s a comprehensive guide to mastering the muscle-up[\s\S]*?(?=Muscle-ups are a challenging exercise|$)/i);
  return compactText(match?.[0] ?? '', 2500);
}

function extractBenefitsSection(text: string): string {
  const match = text.match(/Muscle-ups are a challenging exercise[\s\S]*?(?=▪|PULL-UP|MUSCLE-UP VARIATIONS|$)/i);
  return compactText(match?.[0] ?? '', 2500);
}

function parseVariationNamesFromPageTexts(pageTexts: string[]): string[] {
  const blacklist = new Set([
    'MUSCLE UP VARIATIONS',
    'FULL GYM',
    'NO EQUIPMENT',
    'RESISTANCE BAND',
    'MACHINE',
    'EQUIPMENT',
    'WORKOUT PLANNER 2026 ALL RIGHTS RESERVED SITEMAP',
  ]);

  const results: string[] = [];
  for (const text of pageTexts) {
    const rawLines = text
      .split(/\n+/)
      .map((line) => line.replace(/[©]/g, ' ').replace(/\s+/g, ' ').trim())
      .filter(Boolean)
      .filter((line) => !/^https?:/i.test(line))
      .filter((line) => !/^The Ultimate Guide/i.test(line))
      .filter((line) => !/^-- \d+ of \d+ --$/i.test(line))
      .filter((line) => !/^\d+ sur \d+/i.test(line));

    let buffer = '';
    const flush = () => {
      const normalized = buffer
        .replace(/^EQUIPMENT\s+/i, '')
        .replace(/\bMUSCLE[ -]UP VARIATIONS\b/gi, '')
        .replace(/-/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      const upper = normalized.toUpperCase();
      buffer = '';
      if (!normalized) return;
      if (blacklist.has(upper)) return;
      if (normalized.length < 4) return;
      if (!/[A-Z]{2,}/.test(upper)) return;
      results.push(upper);
    };

    for (const line of rawLines) {
      const upper = line.toUpperCase();
      const looksLikeName = /^[A-Z\- ]+$/.test(upper) && !/[a-z]/.test(line);
      const looksLikeEquipment = /FULL GYM|RESISTANCE BAND|MACHINE|NO EQUIPMENT/i.test(line) || /,/.test(line);
      if (looksLikeEquipment) {
        flush();
        continue;
      }
      if (looksLikeName) {
        buffer = `${buffer} ${upper}`.trim();
        continue;
      }
      flush();
    }
    flush();
  }

  return Array.from(new Set(results)).filter((name) => !['MUSCLE UP', 'BARS', 'CLIMBING MONKEY'].includes(name));
}

async function ensureDir(dirPath: string) {
  await fs.mkdir(dirPath, { recursive: true });
}

async function buildStaticGifFromPng(inputPath: string, outputPath: string): Promise<void> {
  await ensureDir(path.dirname(outputPath));
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(inputPath)
      .inputOptions(['-loop 1', '-t 1.2'])
      .outputOptions(['-vf', 'scale=720:-1:flags=lanczos', '-r', '10'])
      .format('gif')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
}

async function buildAnimatedGifFromFrames(frameA: string, frameB: string, outputPath: string): Promise<void> {
  await ensureDir(path.dirname(outputPath));
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(frameA)
      .inputOptions(['-loop 1', '-t 0.7'])
      .input(frameB)
      .inputOptions(['-loop 1', '-t 0.7'])
      .complexFilter('[0:v][1:v]concat=n=2:v=1:a=0,scale=720:-1:flags=lanczos')
      .outputOptions(['-r', '10'])
      .format('gif')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
}

async function collectGifFrameCandidates(): Promise<Array<{ name: string; frameA: string; frameB: string }>> {
  const entries = await fs.readdir(GIF_SOURCE_DIR);
  const grouped = new Map<string, { one?: string; two?: string }>();
  for (const entry of entries) {
    const match = entry.match(/^(.*)-(1|2)\.png$/i);
    if (!match) continue;
    const [, rawBase, frameNo] = match;
    const current = grouped.get(rawBase) ?? {};
    const full = path.join(GIF_SOURCE_DIR, entry);
    if (frameNo === '1') current.one = full;
    if (frameNo === '2') current.two = full;
    grouped.set(rawBase, current);
  }

  return Array.from(grouped.entries())
    .filter(([, frames]) => frames.one && frames.two)
    .map(([name, frames]) => ({ name, frameA: frames.one!, frameB: frames.two! }));
}

async function fetchExerciseDbByName(name: string): Promise<ExerciseDbEntry | null> {
  if (!RAPIDAPI_KEY) return null;
  const endpoint = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=1&offset=0`;
  const res = await fetch(endpoint, {
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
    },
  });
  if (!res.ok) return null;
  const data = await res.json() as ExerciseDbEntry[];
  return data?.[0] || null;
}

async function extractPdfAssets(pdfPath: string) {
  await ensureDir(TMP_DIR);
  const parser = new PDFParse({ url: pathToFileURL(pdfPath) });
  try {
    const textResult = await parser.getText();
    const variationPageTexts: string[] = [];
    for (const page of [6, 7, 8, 9]) {
      const partial = await parser.getText({ partial: [page] });
      variationPageTexts.push(partial.text);
    }
    const imageResult = await parser.getImage({ imageThreshold: 0 });
    const screenshotResult = await parser.getScreenshot({ partial: [1], desiredWidth: 900, imageDataUrl: false, imageBuffer: true });

    const mainImagePath = path.join(TMP_DIR, 'muscle-up-main.png');
    const screenshotPath = path.join(TMP_DIR, 'muscle-up-page1.png');
    const firstPageImage = imageResult.pages?.[0]?.images?.[0];
    if (firstPageImage?.data) {
      await fs.writeFile(mainImagePath, firstPageImage.data);
    } else if (screenshotResult.pages?.[0]?.data) {
      await fs.writeFile(screenshotPath, screenshotResult.pages[0].data);
    }

    return {
      text: textResult.text,
      variationPageTexts,
      pageCount: textResult.pages.length,
      mainPngPath: firstPageImage?.data ? mainImagePath : screenshotResult.pages?.[0]?.data ? screenshotPath : null,
    };
  } finally {
    await parser.destroy?.();
  }
}

async function buildMainExerciseGif(mainPngPath: string | null, slug: string): Promise<string | null> {
  if (!mainPngPath) return null;
  const outputPath = path.join(OUTPUT_DIR, `${slug}.gif`);
  await buildStaticGifFromPng(mainPngPath, outputPath);
  return `/exercise-media/generated/${slug}.gif`;
}

async function buildMatchedGif(name: string, gifCandidates: Array<{ name: string; frameA: string; frameB: string }>): Promise<{ gifUrl: string | null; match: Record<string, unknown> | null }> {
  const best = findBestNameMatch(
    name,
    gifCandidates.map((item) => ({ name: item.name })),
    0.68,
  );
  if (!best) return { gifUrl: null, match: null };
  const selected = gifCandidates.find((item) => item.name === best.name);
  if (!selected) return { gifUrl: null, match: null };
  const slug = toExerciseMediaSlug(name);
  const outputPath = path.join(OUTPUT_DIR, `${slug}.gif`);
  await buildAnimatedGifFromFrames(selected.frameA, selected.frameB, outputPath);
  return {
    gifUrl: `/exercise-media/generated/${slug}.gif`,
    match: { matchedName: selected.name, matchedOn: best.matchedOn, score: best.score },
  };
}

async function resolveVariationMedia(name: string, gifCandidates: Array<{ name: string; frameA: string; frameB: string }>) {
  const local = await buildMatchedGif(name, gifCandidates);
  if (local.gifUrl) {
    return {
      gifUrl: local.gifUrl,
      match: local.match,
      description: '',
      instructions: '',
      category: null as string | null,
    };
  }

  const apiEntry = await fetchExerciseDbByName(name);
  if (apiEntry?.gifUrl) {
    return {
      gifUrl: apiEntry.gifUrl,
      match: { source: 'exerciseDB', matchedName: apiEntry.name || name },
      description: compactText(`${apiEntry.bodyPart || ''} ${apiEntry.target || ''}`.trim(), 300),
      instructions: compactText((apiEntry.instructions || []).join(' '), 1200),
      category: apiEntry.bodyPart || null,
    };
  }

  const normalized = normalizeExerciseName(name);
  if (normalized.includes('pull up') || normalized.includes('chin up')) {
    return {
      gifUrl: '/exercise-media/generated/pull-up.gif',
      match: { source: 'generic-fallback', matchedName: 'pull-up' },
      description: '',
      instructions: '',
      category: 'Back / Wing',
    };
  }

  return {
    gifUrl: '/exercise-media/generated/muscle-up.gif',
    match: { source: 'generic-fallback', matchedName: 'muscle-up' },
    description: '',
    instructions: '',
    category: 'Back / Wing',
  };
}

async function upsertExercise(entry: PdfExercise) {
  await prisma.exerciseTranslation.upsert({
    where: { sourceName: entry.normalizedName },
    create: {
      sourceName: entry.normalizedName,
      translatedName: entry.name,
      translatedDescription: entry.description || null,
      instructionsFr: entry.instructions || null,
      gifUrl: entry.gifUrl,
      category: entry.category,
      metadata: entry.metadata as Prisma.InputJsonValue,
      sourceApi: entry.sourceApi,
    },
    update: {
      translatedName: entry.name,
      translatedDescription: entry.description || null,
      instructionsFr: entry.instructions || null,
      gifUrl: entry.gifUrl,
      category: entry.category,
      metadata: entry.metadata as Prisma.InputJsonValue,
      sourceApi: entry.sourceApi,
    },
  });
}

async function main() {
  const extracted = await extractPdfAssets(PDF_PATH);
  const text = extracted.text;
  const mainTitle = titleCaseFromSlug(toExerciseMediaSlug(extractMainTitle(text)));
  const normalizedMain = normalizeExerciseName(mainTitle);
  const categories = extractPrimaryCategories(text);
  const equipment = extractEquipment(text);
  const description = compactText([
    text.match(/The muscle-up is a compound exercise[\s\S]*?(?=Here are the general steps)/i)?.[0] ?? '',
    extractGuideSection(text),
    extractBenefitsSection(text),
  ].join('\n\n'), 3500);
  const instructions = extractHowToSection(text);
  const variations = parseVariationNamesFromPageTexts(extracted.variationPageTexts);
  const gifCandidates = await collectGifFrameCandidates();
  const catalogCandidates = listCatalogCandidates();

  await prisma.exerciseTranslation.deleteMany({ where: { sourceApi: SOURCE_API } });

  const mainGifUrl = await buildMainExerciseGif(extracted.mainPngPath, toExerciseMediaSlug(mainTitle));
  const mainCatalogMatch = findBestNameMatch(mainTitle, catalogCandidates, 0.55);
  await upsertExercise({
    name: mainTitle,
    normalizedName: normalizedMain,
    description,
    instructions,
    category: categories.join(', ') || null,
    sourceApi: SOURCE_API,
    gifUrl: mainGifUrl,
    metadata: {
      sourceLabel: 'Muscle Up',
      sourceFile: PDF_PATH,
      pageCount: extracted.pageCount,
      categories,
      equipment,
      variations,
      catalogMatch: mainCatalogMatch,
    },
  });

  for (const variationName of variations) {
    const normalizedName = normalizeExerciseName(variationName);
    const media = await resolveVariationMedia(variationName, gifCandidates);
    const catalogMatch = findBestNameMatch(variationName, catalogCandidates, 0.55);
    const relatedToMain = scoreExerciseNameMatch(variationName, mainTitle);

    await upsertExercise({
      name: titleCaseFromSlug(toExerciseMediaSlug(variationName)),
      normalizedName,
      description: compactText(
        [
          `Variation du guide Muscle-Up. Exercice lié: ${mainTitle}.`,
          media.description,
        ].filter(Boolean).join(' '),
        500,
      ),
      instructions: media.instructions,
      category: media.category || categories.join(', ') || null,
      sourceApi: SOURCE_API,
      gifUrl: media.gifUrl,
      metadata: {
        sourceLabel: 'Muscle Up',
        sourceFile: PDF_PATH,
        parentExercise: normalizedMain,
        derivedFromPdfSection: 'variations',
        catalogMatch,
        gifMatch: media.match,
        relatedToMainScore: relatedToMain,
      },
    });
  }

  const reportPath = path.resolve(process.cwd(), 'scripts', 'output', 'muscle-up-import-report.json');
  await ensureDir(path.dirname(reportPath));
  await fs.writeFile(reportPath, JSON.stringify({
    importedAt: new Date().toISOString(),
    sourceFile: PDF_PATH,
    mainExercise: mainTitle,
    variations,
    outputDir: OUTPUT_DIR,
  }, null, 2));

  console.log(`[muscle-up-import] Imported main exercise and ${variations.length} variations from ${PDF_PATH}`);
}

main()
  .catch((error) => {
    console.error('[muscle-up-import] Failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });