import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

const TRACKED_EXERCISES = ['tractions', 'pompes', 'dips', 'squats'];

type MemberPerf = {
  id: string;
  score: number;
  exercise: string;
};

function computeMemberScore(perfs: MemberPerf[]): number {
  const bestByExercise = new Map<string, number>();
  for (const p of perfs) {
    if (!TRACKED_EXERCISES.includes(p.exercise)) continue;
    const prev = bestByExercise.get(p.exercise) ?? -Infinity;
    if (p.score > prev) bestByExercise.set(p.exercise, p.score);
  }

  let total = 0;
  for (const ex of TRACKED_EXERCISES) {
    total += bestByExercise.get(ex) ?? 0;
  }

  return total;
}

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const groups = await prisma.group.findMany({
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                pseudo: true,
                name: true,
                performances: {
                  where: { status: 'validated' },
                  select: { id: true, score: true, exercise: true },
                },
              },
            },
          },
        },
      },
    });

    const leaderboard = groups
      .map((group) => {
        const members = group.members.map((m) => m.user);
        const memberScores = members.map((member) => ({
          userId: member.id,
          pseudo: member.pseudo ?? member.name ?? 'Athlete',
          score: computeMemberScore(member.performances as MemberPerf[]),
        }));

        const totalScore = memberScores.reduce((acc, m) => acc + m.score, 0);
        const avgScore = memberScores.length > 0 ? totalScore / memberScores.length : 0;
        const topMember = memberScores.sort((a, b) => b.score - a.score)[0] ?? null;

        return {
          groupId: group.id,
          groupName: group.name,
          membersCount: members.length,
          totalScore: Math.round(totalScore),
          avgScore: Math.round(avgScore * 10) / 10,
          topMember,
          isMember: group.members.some((m) => m.userId === payload.userId),
        };
      })
      .sort((a, b) => b.totalScore - a.totalScore)
      .map((g, index) => ({ ...g, rank: index + 1 }));

    return NextResponse.json({
      trackedExercises: TRACKED_EXERCISES,
      leaderboard,
    });
  } catch (error) {
    console.error('Groups leaderboard error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
