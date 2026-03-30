import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logApiCall } from '@/lib/api-logger';
import { findCatalogExerciseMedia, normalizeExerciseName, toExerciseMediaSlug } from '@/lib/exercise-media';
import { findBestNameMatch, listCatalogCandidates, scoreExerciseNameMatch } from '@/lib/exercise-matching';

type ExerciseDbEntry = {
 name?: string;
 gifUrl?: string;
 bodyPart?: string;
 target?: string;
 instructions?: string[];
};

type ExerciseTranslationRow = {
 id: string;
 sourceName: string;
 translatedName: string;
 translatedDescription: string | null;
 gifUrl: string | null;
 instructionsFr: string | null;
 category?: string | null;
 metadata?: unknown;
 sourceApi: string;
};

async function findBestExerciseTranslation(query: string): Promise<ExerciseTranslationRow | null> {
 const normalized = normalizeExerciseName(query);
 const exact = await prisma.exerciseTranslation.findUnique({ where: { sourceName: normalized } });
 if (exact) return exact as ExerciseTranslationRow;

 const all = await prisma.exerciseTranslation.findMany({
  select: {
   id: true,
   sourceName: true,
   translatedName: true,
   translatedDescription: true,
   gifUrl: true,
   instructionsFr: true,
   category: true,
   metadata: true,
   sourceApi: true,
  },
 });

 let best: { row: ExerciseTranslationRow; score: number } | null = null;
 for (const row of all as ExerciseTranslationRow[]) {
  const metadata = typeof row.metadata === 'object' && row.metadata ? row.metadata as Record<string, unknown> : {};
  const aliases = Array.isArray(metadata.aliases) ? metadata.aliases.filter((value): value is string => typeof value === 'string') : [];
  const candidates = [row.sourceName, row.translatedName, ...aliases].filter(Boolean);
  for (const candidate of candidates) {
   const score = scoreExerciseNameMatch(query, candidate);
   if (!best || score > best.score) best = { row, score };
  }
 }

 return best && best.score >= 0.68 ? best.row : null;
}

async function maybeTranslateToEnglish(text: string): Promise<string> {
 if (!text.trim()) return text;
 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) return text;

 try {
 const openai = new OpenAI({ apiKey });
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 temperature: 0,
 max_tokens: 80,
 messages: [
 {
 role: 'system',
 content: 'Translate this fitness exercise name to concise English. Reply only with the translated name.',
 },
 { role: 'user', content: text },
 ],
 });
 return completion.choices[0]?.message?.content?.trim() || text;
 } catch {
 return text;
 }
}

async function fetchExerciseByName(query: string) {
 const key = process.env.RAPIDAPI_KEY;
 if (!key) return { item: null as ExerciseDbEntry | null, status: 0, endpoint: '' };

 const endpoint = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(query)}?limit=1&offset=0`;
 const res = await fetch(endpoint, {
 headers: {
 'x-rapidapi-key': key,
 'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
 },
 next: { revalidate: 3600 },
 });

 if (!res.ok) return { item: null as ExerciseDbEntry | null, status: res.status, endpoint };
 const data = await res.json() as ExerciseDbEntry[];
 return { item: data?.[0] || null, status: res.status, endpoint };
}

async function maybeTranslateToFrench(text: string, userId?: string | null): Promise<{ text: string; tokensUsed: number; costEstimate: number }> {
 if (!text.trim()) return { text, tokensUsed: 0, costEstimate: 0 };
 if (/[àâçéèêëîïôûùüÿœ]/i.test(text)) {
 return { text, tokensUsed: 0, costEstimate: 0 };
 }

 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) return { text, tokensUsed: 0, costEstimate: 0 };

 try {
 const openai = new OpenAI({ apiKey });
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 temperature: 0,
 max_tokens: 180,
 messages: [
 {
 role: 'system',
 content: 'Traduis ce texte vers un francais naturel, concis et technique pour une application de sport. Reponds uniquement avec la traduction.',
 },
 { role: 'user', content: text },
 ],
 });

 const tokensUsed = completion.usage?.total_tokens ?? 0;
 const costEstimate = tokensUsed * 0.00000015;
 await logApiCall({
 apiName: 'openai',
 endpoint: 'chat.completions.create',
 requestPayload: { source: 'exercise-media-translate' },
 responseStatus: 200,
 tokensUsed,
 costEstimate,
 userId: userId ?? null,
 });

 return {
 text: completion.choices[0]?.message?.content?.trim() || text,
 tokensUsed,
 costEstimate,
 };
 } catch {
 await logApiCall({
 apiName: 'openai',
 endpoint: 'chat.completions.create',
 requestPayload: { source: 'exercise-media-translate' },
 responseStatus: 500,
 userId: userId ?? null,
 });
 return { text, tokensUsed: 0, costEstimate: 0 };
 }
}

export async function GET(req: NextRequest) {
 const q = (new URL(req.url).searchParams.get('name') || '').trim();
 if (!q) return NextResponse.json({ error: 'name requis' }, { status: 400 });
 const normalizedName = normalizeExerciseName(q);
 const mediaSlug = toExerciseMediaSlug(q);

 const token = req.headers.get('authorization')?.replace('Bearer ', '');
 const payload = token ? verifyToken(token) : null;

 const catalogMedia = findCatalogExerciseMedia(q);
 const supabaseBaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || '';
 const supabaseBucket = process.env.NEXT_PUBLIC_SUPABASE_EXERCISE_BUCKET?.trim() || process.env.SUPABASE_EXERCISE_BUCKET?.trim() || 'exercise-media';

 if (catalogMedia) {
 return NextResponse.json({
 media: {
 name: catalogMedia.label,
	gifUrl: catalogMedia.supabaseUrl || (supabaseBaseUrl ? `${supabaseBaseUrl}/storage/v1/object/public/${supabaseBucket}/${mediaSlug}.webp` : null),
 animationFrames: catalogMedia.frames ?? null,
 bodyPart: null,
 target: null,
 instructionFr: catalogMedia.instructionFr || null,
 source: catalogMedia.supabaseUrl || supabaseBaseUrl ? 'supabase' : 'offline-catalog',
 },
 });
 }

 const cached = await findBestExerciseTranslation(q);
 if (cached?.gifUrl) {
 return NextResponse.json({
 media: {
 name: cached.translatedName,
 gifUrl: cached.gifUrl || null,
  animationFrames: null,
 bodyPart: null,
 target: cached.category || null,
 instructionFr: cached.instructionsFr || cached.translatedDescription || null,
  source: cached.gifUrl?.includes('supabase') ? 'supabase' : 'cache',
 },
 });
 }

 const key = process.env.RAPIDAPI_KEY;
 if (!key) return NextResponse.json({ media: null });

 try {
 const firstTry = await fetchExerciseByName(q);

 await logApiCall({
 apiName: 'exerciseDB',
 endpoint: firstTry.endpoint,
 requestPayload: { query: q, limit: 1 },
 responseStatus: firstTry.status,
 userId: payload?.userId ?? null,
 });

 let item = firstTry.item;
 if (!item) {
 const englishName = await maybeTranslateToEnglish(q);
 if (englishName && englishName.toLowerCase() !== q.toLowerCase()) {
 const secondTry = await fetchExerciseByName(englishName);
 await logApiCall({
 apiName: 'exerciseDB',
 endpoint: secondTry.endpoint,
 requestPayload: { query: englishName, translatedFrom: q, limit: 1 },
 responseStatus: secondTry.status,
 userId: payload?.userId ?? null,
 });
 item = secondTry.item;
 }
 }

 if (!item && cached) {
 return NextResponse.json({
 media: {
 name: cached.translatedName,
 gifUrl: cached.gifUrl || null,
  animationFrames: null,
 bodyPart: null,
 target: cached.category || null,
 instructionFr: cached.instructionsFr || cached.translatedDescription || null,
  source: 'cache',
 },
 });
 }

 if (!item) return NextResponse.json({ media: null });

 const instructionRaw = item.instructions?.slice(0, 2).join(' ') || '';
 const translatedName = await maybeTranslateToFrench(item.name || q, payload?.userId);
 const translatedInstruction = await maybeTranslateToFrench(instructionRaw, payload?.userId);

 await prisma.exerciseTranslation.upsert({
 where: { sourceName: normalizedName },
 create: {
 sourceName: normalizedName,
 translatedName: translatedName.text || item.name || q,
 translatedDescription: translatedInstruction.text || null,
 gifUrl: item.gifUrl || null,
 instructionsFr: translatedInstruction.text || null,
 sourceApi: 'exerciseDB',
 },
 update: {
 translatedName: translatedName.text || item.name || q,
 translatedDescription: translatedInstruction.text || null,
 gifUrl: item.gifUrl || null,
 instructionsFr: translatedInstruction.text || null,
 },
 });

 return NextResponse.json({
 media: {
 name: translatedName.text || item.name || q,
 gifUrl: item.gifUrl || null,
	animationFrames: null,
 bodyPart: item.bodyPart || null,
 target: item.target || null,
 instructionFr: translatedInstruction.text || null,
	source: 'exerciseDB',
 },
 });
 } catch {
 await logApiCall({
 apiName: 'exerciseDB',
 endpoint: 'https://exercisedb.p.rapidapi.com/exercises/name',
 requestPayload: { query: q, limit: 1 },
 responseStatus: 500,
 userId: payload?.userId ?? null,
 });
 return NextResponse.json({ media: null });
 }
}
