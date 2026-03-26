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

    const { searchParams } = new URL(request.url);
    const spotId = searchParams.get('spotId');
    if (!spotId) return NextResponse.json({ error: 'spotId requis' }, { status: 400 });

    const performances = await prisma.performance.findMany({
      where: {
        spotId,
        OR: [
          { status: 'validated' },         // visible to everyone
          { userId: payload.userId },       // own pending perfs visible to self
        ],
      },
      include: {
        user: { select: { id: true, pseudo: true, name: true } },
        validations: { select: { validatorId: true } },
      },
      orderBy: { score: 'desc' },
    });

    return NextResponse.json({ performances, currentUserId: payload.userId });
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
