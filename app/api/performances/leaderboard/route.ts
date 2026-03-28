import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const VALID_EXERCISES = ['tractions', 'pompes', 'dips', 'squats', 'tractions_lestees', 'dips_lestes'];

export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { searchParams } = new URL(request.url);
 const exercise = searchParams.get('exercise') ?? 'tractions';
 const limit = Math.min(parseInt(searchParams.get('limit') ?? '10'), 50);

 if (!VALID_EXERCISES.includes(exercise)) {
 return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
 }

 // For each user, find their best validated performance for this exercise (across all spots)
 const rows = await prisma.performance.findMany({
 where: { exercise, status: 'validated' },
 select: {
 id: true,
 userId: true,
 spotId: true,
 score: true,
 unit: true,
 },
 orderBy: { score: 'desc' },
 });

 const userIds = Array.from(new Set(rows.map((r) => r.userId)));
 const spotIds = Array.from(new Set(rows.map((r) => r.spotId)));

 const [users, spots] = await Promise.all([
 prisma.user.findMany({
 where: { id: { in: userIds } },
 select: { id: true, pseudo: true, name: true },
 }),
 prisma.spot.findMany({
 where: { id: { in: spotIds } },
 select: { id: true, name: true, city: true },
 }),
 ]);

 const userById = new Map(users.map((u) => [u.id, u]));
 const spotById = new Map(spots.map((s) => [s.id, s]));

 // Deduplicate: keep best score per user (full list for ranking)
 const seen = new Set<string>();
 const deduped: typeof rows = [];
 for (const row of rows) {
 if (!seen.has(row.userId)) {
 seen.add(row.userId);
 deduped.push(row);
 }
 }

 const leaderboard = deduped.slice(0, limit);

 // Find current user's rank even if outside top N
 const myIndex = deduped.findIndex(r => r.userId === payload.userId);
 const myEntry = myIndex >= 0 ? {
 rank: myIndex + 1,
 userId: deduped[myIndex].userId,
 pseudo: userById.get(deduped[myIndex].userId)?.pseudo ?? userById.get(deduped[myIndex].userId)?.name ?? 'Anonyme',
 score: deduped[myIndex].score,
 unit: deduped[myIndex].unit,
 spotName: spotById.get(deduped[myIndex].spotId)?.name ?? 'Spot inconnu',
 spotCity: spotById.get(deduped[myIndex].spotId)?.city ?? null,
 performanceId: deduped[myIndex].id,
 } : null;

 return NextResponse.json({
 exercise,
 total: deduped.length,
 leaderboard: leaderboard.map((r, i) => ({
 rank: i + 1,
 userId: r.userId,
 pseudo: userById.get(r.userId)?.pseudo ?? userById.get(r.userId)?.name ?? 'Anonyme',
 score: r.score,
 unit: r.unit,
 spotName: spotById.get(r.spotId)?.name ?? 'Spot inconnu',
 spotCity: spotById.get(r.spotId)?.city ?? null,
 performanceId: r.id,
 })),
 myEntry,
 });
 } catch (error) {
 console.error('Leaderboard error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
