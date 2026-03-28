import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import fs from 'node:fs/promises';
import path from 'node:path';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

const execAsync = promisify(exec);

async function readScrapeSummary() {
 const outputPath = path.join(process.cwd(), 'scripts', 'output', 'exercises-scraped.json');
 try {
 const raw = await fs.readFile(outputPath, 'utf8');
 const data = JSON.parse(raw) as {
 generatedAt?: string;
 summary?: { pagesVisited?: number; rawItems?: number; uniqueExercises?: number };
 config?: { maxPagesPerSource?: number; timeoutMs?: number; delayMs?: number; seedCount?: number; topic?: string | null };
 exercises?: unknown[];
 };

 return {
 exists: true,
 generatedAt: data.generatedAt ?? null,
 pagesVisited: data.summary?.pagesVisited ?? 0,
 rawItems: data.summary?.rawItems ?? 0,
 uniqueExercises: data.summary?.uniqueExercises ?? (Array.isArray(data.exercises) ? data.exercises.length : 0),
 config: data.config ?? null,
 filePath: outputPath,
 };
 } catch {
 return { exists: false, generatedAt: null, pagesVisited: 0, rawItems: 0, uniqueExercises: 0, config: null, filePath: outputPath };
 }
}

export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'scraper:read');
 if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

 const summary = await readScrapeSummary();
 const dbCount = await prisma.exerciseTranslation.count({ where: { sourceApi: 'web-scrape' } });

 return NextResponse.json({
 summary,
 dbCount,
 });
}

export async function POST(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'scraper:write');
 if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

 const body = await request.json().catch(() => ({}));
 const maxPages = Math.max(1, Math.min(30, Number(body.maxPages || 8)));
 const timeoutMs = Math.max(4000, Math.min(30000, Number(body.timeoutMs || 9000)));
 const minSources = Math.max(1, Math.min(10, Number(body.minSources || 2)));
 const minQuality = Math.max(1, Math.min(20, Number(body.minQuality || 5)));
 const topic = typeof body.topic === 'string' ? body.topic.trim().slice(0, 120) : '';

 try {
 const topicArg = topic ? ` --topic-b64=${Buffer.from(topic, 'utf8').toString('base64')}` : '';
 const scrapeCmd = `npm run scrape:exercises -- --max-pages=${maxPages} --timeout-ms=${timeoutMs}${topicArg}`;
 const importCmd = `npm run import:exercises -- --min-sources=${minSources} --min-quality=${minQuality}`;

 const scrape = await execAsync(scrapeCmd, {
 cwd: process.cwd(),
 timeout: 8 * 60 * 1000,
 maxBuffer: 1024 * 1024 * 8,
 });

 const imported = await execAsync(importCmd, {
 cwd: process.cwd(),
 timeout: 5 * 60 * 1000,
 maxBuffer: 1024 * 1024 * 8,
 });

 const summary = await readScrapeSummary();
 const dbCount = await prisma.exerciseTranslation.count({ where: { sourceApi: 'web-scrape' } });

 await logAdminAction(admin.userId, 'admin.scraper.run', `topic=${topic || 'default'} raw=${summary.rawItems} unique=${summary.uniqueExercises} db=${dbCount}`);

 return NextResponse.json({
 ok: true,
 summary,
 dbCount,
 output: {
 scrape: `${scrape.stdout || ''}${scrape.stderr || ''}`.slice(-8000),
 import: `${imported.stdout || ''}${imported.stderr || ''}`.slice(-8000),
 },
 });
 } catch (error) {
 const msg = error instanceof Error ? error.message : String(error);
 return NextResponse.json({ error: msg }, { status: 500 });
 }
}
