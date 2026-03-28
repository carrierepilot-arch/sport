import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { parseDuelData } from '@/lib/duels';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ duelId: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { duelId } = await params;
    const body = (await request.json().catch(() => ({}))) as { exercise?: string; score?: number };
    const exercise = (body.exercise || '').trim().toLowerCase();
    const score = Number(body.score);

    if (!exercise || !Number.isFinite(score) || score < 0) {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 });
    }

    const duel = await prisma.challenge.findUnique({
      where: { id: duelId },
      select: { id: true, challengeType: true, circuitData: true },
    });

    if (!duel || duel.challengeType !== 'duel_1v1') {
      return NextResponse.json({ error: 'Duel introuvable' }, { status: 404 });
    }

    const data = parseDuelData(duel.circuitData);
    if (!data) return NextResponse.json({ error: 'Donnees duel invalides' }, { status: 500 });

    if (payload.userId !== data.inviterId && payload.userId !== data.inviteeId) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    if (data.status === 'pending') {
      return NextResponse.json({ error: 'Le duel doit etre accepte avant de saisir les scores' }, { status: 409 });
    }

    if (!data.exercises.includes(exercise)) {
      return NextResponse.json({ error: 'Exercice invalide' }, { status: 400 });
    }

    const nextScores = {
      ...data.scores,
      [payload.userId]: {
        ...(data.scores[payload.userId] || {}),
        [exercise]: Math.max(0, Math.trunc(score)),
      },
    };

    const inviterDone = data.exercises.every((ex) => Number.isFinite(Number(nextScores[data.inviterId]?.[ex])));
    const inviteeDone = data.exercises.every((ex) => Number.isFinite(Number(nextScores[data.inviteeId]?.[ex])));

    const nextData = {
      ...data,
      scores: nextScores,
      status: inviterDone && inviteeDone ? ('finished' as const) : data.status,
      finishedAt: inviterDone && inviteeDone ? new Date().toISOString() : data.finishedAt,
    };

    await prisma.challenge.update({ where: { id: duel.id }, data: { circuitData: nextData } });

    return NextResponse.json({ ok: true, duel: nextData });
  } catch (error) {
    console.error('Duel score error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
