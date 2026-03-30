import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl } from '@/lib/social';

const VALID_EXERCISES = ['tractions', 'pompes', 'dips', 'squats', 'tractions_lestees', 'dips_lestes', 'muscle_ups'];

function computeElo(rank: number, total: number): number {
 if (total <= 1) return 1200;
 const ratio = (total - rank) / (total - 1);
 return Math.round(900 + ratio * 1200);
}

function getLeague(elo: number): string {
 if (elo >= 1900) return 'Legende';
 if (elo >= 1700) return 'Diamant';
 if (elo >= 1450) return 'Or';
 if (elo >= 1200) return 'Argent';
 return 'Bronze';
}

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
 const spotIds = Array.from(new Set(rows.map((r) => r.spotId).filter((id): id is string => id !== null)));

 const [users, spots] = await Promise.all([
 prisma.user.findMany({
 where: { id: { in: userIds } },
 select: { id: true, pseudo: true, name: true, equipmentData: true },
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
 elo: computeElo(myIndex + 1, deduped.length),
 league: getLeague(computeElo(myIndex + 1, deduped.length)),
 userId: deduped[myIndex].userId,
 pseudo: userById.get(deduped[myIndex].userId)?.pseudo ?? userById.get(deduped[myIndex].userId)?.name ?? 'Anonyme',
 profileImageUrl: getProfileImageUrl(userById.get(deduped[myIndex].userId)?.equipmentData),
 score: deduped[myIndex].score,
 unit: deduped[myIndex].unit,
 spotName: deduped[myIndex].spotId ? (spotById.get(deduped[myIndex].spotId!)?.name ?? 'Spot inconnu') : 'Sans lieu',
 spotCity: deduped[myIndex].spotId ? (spotById.get(deduped[myIndex].spotId!)?.city ?? null) : null,
 performanceId: deduped[myIndex].id,
 } : null;

 return NextResponse.json({
 exercise,
 total: deduped.length,
 leaderboard: leaderboard.map((r, i) => ({
 rank: i + 1,
 elo: computeElo(i + 1, deduped.length),
 league: getLeague(computeElo(i + 1, deduped.length)),
 userId: r.userId,
 pseudo: userById.get(r.userId)?.pseudo ?? userById.get(r.userId)?.name ?? 'Anonyme',
 profileImageUrl: getProfileImageUrl(userById.get(r.userId)?.equipmentData),
 score: r.score,
 unit: r.unit,
 spotName: r.spotId ? (spotById.get(r.spotId)?.name ?? 'Spot inconnu') : 'Sans lieu',
 spotCity: r.spotId ? (spotById.get(r.spotId)?.city ?? null) : null,
 performanceId: r.id,
 })),
 myEntry,
 });
 } catch (error) {
 console.error('Leaderboard error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
