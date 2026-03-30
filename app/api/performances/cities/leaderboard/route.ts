import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const TRACKED_EXERCISES = ['tractions', 'pompes', 'dips', 'squats'];

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const performances = await prisma.performance.findMany({
      where: {
        status: 'validated',
        exercise: { in: TRACKED_EXERCISES },
        spot: { city: { not: null } },
      },
      include: {
        user: { select: { id: true, pseudo: true, name: true } },
        spot: { select: { city: true } },
      },
    });

    const bestByUserExerciseCity = new Map<string, { city: string; userId: string; pseudo: string; exercise: string; score: number }>();
    for (const perf of performances) {
      const city = perf.spot?.city?.trim();
      if (!city) continue;
      const key = `${city}:${perf.userId}:${perf.exercise}`;
      const prev = bestByUserExerciseCity.get(key);
      if (!prev || perf.score > prev.score) {
        bestByUserExerciseCity.set(key, {
          city,
          userId: perf.userId,
          pseudo: perf.user.pseudo ?? perf.user.name ?? 'Athlete',
          exercise: perf.exercise,
          score: perf.score,
        });
      }
    }

    const cityMap = new Map<string, { city: string; totalScore: number; participantIds: Set<string>; topAthlete: { userId: string; pseudo: string; score: number } | null }>();
    for (const item of bestByUserExerciseCity.values()) {
      const prev = cityMap.get(item.city) ?? {
        city: item.city,
        totalScore: 0,
        participantIds: new Set<string>(),
        topAthlete: null,
      };
      prev.totalScore += item.score;
      prev.participantIds.add(item.userId);
      if (!prev.topAthlete || item.score > prev.topAthlete.score) {
        prev.topAthlete = { userId: item.userId, pseudo: item.pseudo, score: item.score };
      }
      cityMap.set(item.city, prev);
    }

    const leaderboard = Array.from(cityMap.values())
      .sort((a, b) => b.totalScore - a.totalScore)
      .slice(0, 8)
      .map((item, index) => ({
        rank: index + 1,
        city: item.city,
        totalScore: Math.round(item.totalScore),
        participants: item.participantIds.size,
        topAthlete: item.topAthlete,
      }));

    return NextResponse.json({ leaderboard, viewerId: payload.userId });
  } catch (error) {
    console.error('Cities leaderboard error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
