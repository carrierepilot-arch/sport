import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const VALID_EXERCISES = ['tractions', 'pompes', 'dips', 'squats', 'tractions_lestees', 'dips_lestes'];
const EXERCISE_UNIT: Record<string, string> = {
 tractions: 'reps', pompes: 'reps', dips: 'reps', squats: 'reps',
 tractions_lestees: 'kg', dips_lestes: 'kg',
};

// GET — leaderboard for a spot
export async function GET(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const requester = await prisma.user.findUnique({
 where: { id: payload.userId },
 select: { isAdmin: true },
 });
 const isAdmin = !!requester?.isAdmin;

 const { searchParams } = new URL(request.url);
 const spotId = searchParams.get('spotId');
 if (!spotId) return NextResponse.json({ error: 'spotId requis' }, { status: 400 });

 let performances: Array<{
 id: string;
 userId: string;
 spotId: string;
 exercise: string;
 score: number;
 unit: string;
 status: string;
 videoUrl: string | null;
 createdAt: Date;
 videoStoragePath?: string | null;
 user: { id: string; pseudo: string | null; name: string | null };
 validations: { validatorId: string }[];
 }> = [];

 try {
 performances = await prisma.performance.findMany({
 where: {
 spotId,
 OR: [
 { status: 'validated' },
 { userId: payload.userId },
 ],
 },
 include: {
 user: { select: { id: true, pseudo: true, name: true } },
 validations: { select: { validatorId: true } },
 },
 orderBy: { score: 'desc' },
 });
 } catch {
 performances = await prisma.performance.findMany({
 where: {
 spotId,
 OR: [
 { status: 'validated' },
 { userId: payload.userId },
 ],
 },
 select: {
 id: true,
 userId: true,
 spotId: true,
 exercise: true,
 score: true,
 unit: true,
 status: true,
 videoUrl: true,
 createdAt: true,
 user: { select: { id: true, pseudo: true, name: true } },
 validations: { select: { validatorId: true } },
 },
 orderBy: { score: 'desc' },
 });
 }

 // Return performances — videos on Vercel Blob are already public URLs,
 // no signed URL needed. Just mask video URLs for non-owners/non-admins.
 const safePerformances = performances.map((performance) => {
 if (!(isAdmin || performance.userId === payload.userId)) {
 return { ...performance, videoUrl: null };
 }
 return performance;
 });

 return NextResponse.json({ performances: safePerformances, currentUserId: payload.userId });
 } catch (error) {
 console.error('Performances GET error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

// POST — add a performance
export async function POST(request: NextRequest) {
 try {
 const token = request.headers.get('authorization')?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const { spotId, exercise, score } = await request.json();

 if (!spotId || !exercise || score === undefined || score === null) {
 return NextResponse.json({ error: 'spotId, exercise et score requis' }, { status: 400 });
 }
 if (!VALID_EXERCISES.includes(exercise)) {
 return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
 }
 const scoreNum = Number(score);
 if (isNaN(scoreNum) || scoreNum <= 0) {
 return NextResponse.json({ error: 'Score invalide (doit être > 0)' }, { status: 400 });
 }

 const spot = await prisma.spot.findUnique({ where: { id: spotId } });
 if (!spot) return NextResponse.json({ error: 'Spot introuvable' }, { status: 404 });

 const performance = await prisma.performance.create({
 data: {
 userId: payload.userId,
 spotId,
 exercise,
 score: scoreNum,
 unit: EXERCISE_UNIT[exercise] ?? 'reps',
 status: 'pending',
 },
 include: {
 user: { select: { id: true, pseudo: true, name: true } },
 validations: { select: { validatorId: true } },
 },
 });

 return NextResponse.json({ performance });
 } catch (error) {
 console.error('Performance POST error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
