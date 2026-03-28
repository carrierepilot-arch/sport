import { NextRequest, NextResponse } from 'next/server';
import fs from 'node:fs/promises';
import path from 'node:path';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

type RawScrapedExercise = {
  sourceName?: string;
  translatedName?: string;
  name?: string;
  translatedDescription?: string;
  categories?: string[];
  sourceCount?: number;
  qualityScore?: number;
};

type Candidate = {
  id: string;
  sourceName: string;
  translatedName: string;
  translatedDescription: string;
  categories: string[];
  sourceCount: number;
  qualityScore: number;
  existsInDb: boolean;
};

const OUTPUT_PATH = path.join(process.cwd(), 'scripts', 'output', 'exercises-scraped.json');

function normalizeCandidate(ex: RawScrapedExercise): Candidate | null {
  const sourceName = String(ex.sourceName || ex.translatedName || ex.name || '').trim();
  if (!sourceName) return null;

  const translatedName = String(ex.translatedName || ex.name || sourceName).trim();
  const categories = Array.isArray(ex.categories)
    ? ex.categories.map((c) => String(c).trim()).filter(Boolean).slice(0, 8)
    : [];
  const sourceCount = Math.max(0, Math.min(50, Number(ex.sourceCount ?? 0)));
  const qualityScore = Math.max(0, Math.min(100, Number(ex.qualityScore ?? 0)));

  const metadataLine = `Categories: ${categories.join(', ') || 'general'} | Sources: ${sourceCount} | Quality: ${qualityScore}`;
  const translatedDescription = `${String(ex.translatedDescription || '').trim()}${String(ex.translatedDescription || '').trim() ? '\n\n' : ''}${metadataLine}`.slice(0, 1800);

  return {
    id: sourceName.toLowerCase().replace(/\s+/g, '-').slice(0, 120),
    sourceName,
    translatedName,
    translatedDescription,
    categories,
    sourceCount,
    qualityScore,
    existsInDb: false,
  };
}

async function loadCandidates(): Promise<Candidate[]> {
  const raw = await fs.readFile(OUTPUT_PATH, 'utf8');
  const parsed = JSON.parse(raw) as { exercises?: RawScrapedExercise[] };
  const exercises = Array.isArray(parsed.exercises) ? parsed.exercises : [];
  const unique = new Map<string, Candidate>();

  for (const ex of exercises) {
    const candidate = normalizeCandidate(ex);
    if (!candidate) continue;
    if (!unique.has(candidate.sourceName.toLowerCase())) unique.set(candidate.sourceName.toLowerCase(), candidate);
  }

  const list = Array.from(unique.values());
  const existing = await prisma.exerciseTranslation.findMany({
    where: { sourceName: { in: list.map((item) => item.sourceName) } },
    select: { sourceName: true },
  });
  const set = new Set(existing.map((item) => item.sourceName.toLowerCase()));

  return list
    .map((item) => ({ ...item, existsInDb: set.has(item.sourceName.toLowerCase()) }))
    .sort((a, b) => b.qualityScore - a.qualityScore);
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminPermission(request, 'scraper:read');
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  try {
    const candidates = await loadCandidates();
    return NextResponse.json({ candidates, total: candidates.length });
  } catch {
    return NextResponse.json({ candidates: [], total: 0, missingOutput: true });
  }
}

export async function POST(request: NextRequest) {
  const admin = await requireAdminPermission(request, 'scraper:write');
  if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

  const body = (await request.json().catch(() => ({}))) as { ids?: string[] };
  const ids = Array.isArray(body.ids) ? body.ids.map((id) => String(id)) : [];
  if (ids.length === 0) return NextResponse.json({ error: 'Aucune validation fournie' }, { status: 400 });

  try {
    const candidates = await loadCandidates();
    const selected = candidates.filter((item) => ids.includes(item.id));

    let upserted = 0;
    for (const item of selected) {
      await prisma.exerciseTranslation.upsert({
        where: { sourceName: item.sourceName },
        update: {
          translatedName: item.translatedName,
          translatedDescription: item.translatedDescription,
          sourceApi: 'web-scrape',
        },
        create: {
          sourceName: item.sourceName,
          translatedName: item.translatedName,
          translatedDescription: item.translatedDescription,
          sourceApi: 'web-scrape',
        },
      });
      upserted += 1;
    }

    await logAdminAction(admin.userId, 'admin.scraper.manual_validate', `validated=${selected.length} upserted=${upserted}`);
    return NextResponse.json({ ok: true, validated: selected.length, upserted });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Erreur serveur';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
