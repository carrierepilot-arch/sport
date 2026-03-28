import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// GET /api/performances/spots/[spotId] — spot details with regulars + top performances
export async function GET(
 request: NextRequest,
 { params }: { params: Promise<{ spotId: string }> }
) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { spotId } = await params;

 const spot = await prisma.spot.findUnique({
 where: { id: spotId },
 include: {
 regulars: {
 include: { user: { select: { id: true, pseudo: true, name: true } } },
 orderBy: { createdAt: 'asc' },
 },
 _count: { select: { performances: true, regulars: true } },
 },
 });

 if (!spot) return NextResponse.json({ error: 'Spot introuvable' }, { status: 404 });

 // Check if current user is a regular
 const isRegular = spot.regulars.some(r => r.userId === payload.userId);

 // Get top performance per exercise (only validated or pending)
 const exercises = ['tractions', 'pompes', 'dips', 'squats', 'tractions_lestees', 'dips_lestes'];
 const leaderboard: Record<string, { userId: string; pseudo: string | null; name: string | null; score: number; unit: string; status: string }[]> = {};

 for (const ex of exercises) {
 const perfs = await prisma.performance.findMany({
 where: { spotId, exercise: ex },
 include: { user: { select: { id: true, pseudo: true, name: true } } },
 orderBy: { score: 'desc' },
 take: 5,
 });
 if (perfs.length > 0) {
 leaderboard[ex] = perfs.map(p => ({
 userId: p.userId,
 pseudo: p.user.pseudo,
 name: p.user.name,
 score: p.score,
 unit: p.unit,
 status: p.status,
 }));
 }
 }

 // Get accepted friends of the current user
 const friends = await prisma.friendRequest.findMany({
 where: {
 status: 'accepted',
 OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
 },
 });
 const friendIds = new Set(friends.map(f => f.senderId === payload.userId ? f.receiverId : f.senderId));

 return NextResponse.json({
 spot: {
 id: spot.id,
 name: spot.name,
 city: spot.city,
 latitude: spot.latitude,
 longitude: spot.longitude,
 regularsCount: spot._count.regulars,
 performancesCount: spot._count.performances,
 },
 regulars: spot.regulars.map(r => ({
 userId: r.user.id,
 pseudo: r.user.pseudo,
 name: r.user.name,
 isFriend: friendIds.has(r.user.id),
 isMe: r.user.id === payload.userId,
 })),
 isRegular,
 leaderboard,
 currentUserId: payload.userId,
 });
 } catch (error) {
 console.error('Spot detail error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
