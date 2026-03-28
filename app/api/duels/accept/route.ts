import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { parseDuelData, serializeDuelAcceptedMessage } from '@/lib/duels';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as { duelId?: string };
    const duelId = (body.duelId || '').trim();
    if (!duelId) return NextResponse.json({ error: 'duelId requis' }, { status: 400 });

    const duel = await prisma.challenge.findUnique({
      where: { id: duelId },
      select: { id: true, challengeType: true, creatorId: true, circuitData: true },
    });

    if (!duel || duel.challengeType !== 'duel_1v1') {
      return NextResponse.json({ error: 'Duel introuvable' }, { status: 404 });
    }

    const data = parseDuelData(duel.circuitData);
    if (!data) return NextResponse.json({ error: 'Donnees duel invalides' }, { status: 500 });

    if (payload.userId !== data.inviteeId) {
      return NextResponse.json({ error: 'Seul linvite peut accepter ce duel' }, { status: 403 });
    }

    if (data.status !== 'pending') {
      return NextResponse.json({ error: 'Ce duel est deja accepte ou termine' }, { status: 409 });
    }

    const nextData = {
      ...data,
      status: 'accepted' as const,
      acceptedAt: new Date().toISOString(),
    };

    await prisma.challenge.update({ where: { id: duelId }, data: { circuitData: nextData } });

    await prisma.message.create({
      data: {
        senderId: payload.userId,
        receiverId: data.inviterId,
        content: serializeDuelAcceptedMessage({ duelId, inviteeId: payload.userId }),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: payload.userId,
        action: 'duel_invite_accepted',
        details: duelId,
      },
    });

    return NextResponse.json({ ok: true, duelId });
  } catch (error) {
    console.error('Duel accept error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
