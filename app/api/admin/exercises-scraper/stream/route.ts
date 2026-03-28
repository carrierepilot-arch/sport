import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { runScraper, ScraperEvent } from '@/lib/scraper';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

const IMPORT_NOISE_RE = /(workout|exercise(s)?|guide|tips|program|article|news|review|membership|calculator|about|contact|privacy|policy|store|shop|account|login)/i;

function compactText(value: string, max = 1000): string {
 const v = value.replace(/\s+/g, ' ').trim();
 return v.length <= max ? v : v.slice(0, max);
}

export const maxDuration = 300;

export async function POST(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'scraper:write');
 if (!admin) {
 return new Response(JSON.stringify({ error: 'Acces refuse' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
 }

 const body = await request.json().catch(() => ({}));
 const maxPages = Math.max(1, Math.min(30, Number(body.maxPages || 8)));
 const timeoutMs = Math.max(4000, Math.min(30000, Number(body.timeoutMs || 9000)));
 const minSources = Math.max(1, Math.min(10, Number(body.minSources || 2)));
 const minQuality = Math.max(1, Math.min(20, Number(body.minQuality || 5)));
 const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 120) : '';

 const encoder = new TextEncoder();

 const stream = new ReadableStream({
 async start(controller) {
 function send(event: ScraperEvent | Record<string, unknown>) {
 controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
 }

 try {
 // Phase 1: Scrape — runs inline, no child process needed
 const result = await runScraper(
 { maxPagesPerSource: maxPages, timeoutMs, crawlDelayMs: 250, topic },
 send,
 );

 // Phase 2: Import to DB
 send({ type: 'import_start' });

 const filtered = result.exercises.filter((item) => {
 if (!item.name || !item.slug) return false;
 if (item.sourceCount < minSources) return false;
 if (item.qualityScore < minQuality) return false;
 if (IMPORT_NOISE_RE.test(item.name)) return false;
 return item.name.split(/\s+/).filter(Boolean).length <= 5;
 });

 send({ type: 'import_progress', total: filtered.length });

 let upserted = 0;
 for (const item of filtered) {
 const description = compactText(
 `Categories: ${item.categories.join(', ')} | Sources: ${item.sourceCount} | Quality: ${item.qualityScore}`,
 400,
 );
 await prisma.exerciseTranslation.upsert({
 where: { sourceName: item.slug },
 update: { translatedName: compactText(item.name, 120), translatedDescription: description, sourceApi: 'web-scrape' },
 create: { sourceName: item.slug, translatedName: compactText(item.name, 120), translatedDescription: description, instructionsFr: null, sourceApi: 'web-scrape' },
 });
 upserted++;
 }

 const dbCount = await prisma.exerciseTranslation.count({ where: { sourceApi: 'web-scrape' } });
 send({ type: 'import_done', upserted, dbCount });
 await logAdminAction(admin.userId, 'admin.scraper.stream_run', `topic=${topic || 'default'} raw=${result.summary.rawItems} unique=${result.summary.uniqueExercises} upserted=${upserted} db=${dbCount}`);
 send({ type: 'finished' });
 } catch (err) {
 send({ type: 'error', phase: 'scrape', message: err instanceof Error ? err.message : String(err) });
 }

 controller.close();
 },
 });

 return new Response(stream, {
 headers: {
 'Content-Type': 'text/event-stream',
 'Cache-Control': 'no-cache, no-transform',
 'Connection': 'keep-alive',
 'X-Accel-Buffering': 'no',
 },
 });
}
