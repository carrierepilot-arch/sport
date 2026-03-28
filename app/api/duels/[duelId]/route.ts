import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { parseDuelData } from '@/lib/duels';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ duelId: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { duelId } = await params;

    const duel = await prisma.challenge.findUnique({
      where: { id: duelId },
      select: {
        id: true,
        challengeType: true,
        circuitData: true,
        creatorId: true,
      },
    });

    if (!duel || duel.challengeType !== 'duel_1v1') {
      return NextResponse.json({ error: 'Duel introuvable' }, { status: 404 });
    }

    const data = parseDuelData(duel.circuitData);
    if (!data) return NextResponse.json({ error: 'Donnees duel invalides' }, { status: 500 });

    if (payload.userId !== data.inviterId && payload.userId !== data.inviteeId) {
      return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: [data.inviterId, data.inviteeId] } },
      select: { id: true, pseudo: true, name: true, email: true },
    });

    const inviter = users.find((u) => u.id === data.inviterId);
    const invitee = users.find((u) => u.id === data.inviteeId);

    return NextResponse.json({
      duel: {
        id: duel.id,
        status: data.status,
        exercises: data.exercises,
        scores: data.scores,
        acceptedAt: data.acceptedAt,
        finishedAt: data.finishedAt,
        inviter: inviter
          ? { id: inviter.id, pseudo: inviter.pseudo ?? inviter.name ?? inviter.email }
          : { id: data.inviterId, pseudo: 'Utilisateur' },
        invitee: invitee
          ? { id: invitee.id, pseudo: invitee.pseudo ?? invitee.name ?? invitee.email }
          : { id: data.inviteeId, pseudo: 'Utilisateur' },
      },
      viewerId: payload.userId,
      canAccept: payload.userId === data.inviteeId && data.status === 'pending',
    });
  } catch (error) {
    console.error('Duel get error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
