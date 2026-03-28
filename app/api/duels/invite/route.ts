import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { createDuelData, serializeDuelInviteMessage } from '@/lib/duels';

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = (await request.json().catch(() => ({}))) as {
      friendId?: string;
      exercise?: string;
      score?: number;
    };

    const friendId = (body.friendId || '').trim();
    const exercise = (body.exercise || '').trim().toLowerCase();
    const score = Number(body.score);

    if (!friendId || !exercise || !Number.isFinite(score) || score <= 0) {
      return NextResponse.json({ error: 'Parametres invalides' }, { status: 400 });
    }

    if (friendId === payload.userId) {
      return NextResponse.json({ error: 'Impossible de se defier soi-meme' }, { status: 400 });
    }

    const [friendship, target] = await Promise.all([
      prisma.friendRequest.findFirst({
        where: {
          status: 'accepted',
          OR: [
            { senderId: payload.userId, receiverId: friendId },
            { senderId: friendId, receiverId: payload.userId },
          ],
        },
        select: { id: true },
      }),
      prisma.user.findUnique({ where: { id: friendId }, select: { id: true, pseudo: true, name: true, email: true } }),
    ]);

    if (!friendship) return NextResponse.json({ error: 'Cet utilisateur nest pas votre ami' }, { status: 403 });
    if (!target) return NextResponse.json({ error: 'Utilisateur cible introuvable' }, { status: 404 });

    const duelData = createDuelData({
      inviterId: payload.userId,
      inviteeId: friendId,
      initialExercise: exercise,
      initialScore: score,
    });

    const challenge = await prisma.challenge.create({
      data: {
        title: `Duel 1v1 - ${exercise}`,
        description: `Invitation duel 1v1 sur ${exercise}`,
        exercise,
        target: score,
        unit: 'reps',
        badgeCode: '',
        badgeLabel: '',
        creatorId: payload.userId,
        visibility: 'private',
        isPublic: false,
        submittedForReview: false,
        adminApproved: false,
        challengeType: 'duel_1v1',
        difficulty: 1,
        circuitData: duelData,
      },
      select: { id: true },
    });

    await prisma.message.create({
      data: {
        senderId: payload.userId,
        receiverId: friendId,
        content: serializeDuelInviteMessage({
          duelId: challenge.id,
          exercise,
          score,
          inviterId: payload.userId,
        }),
      },
    });

    await prisma.activityLog.create({
      data: {
        userId: payload.userId,
        action: 'duel_invite_sent',
        details: `${challenge.id} -> ${target.email}`,
      },
    });

    return NextResponse.json({
      ok: true,
      duelId: challenge.id,
      target: {
        id: target.id,
        pseudo: target.pseudo ?? target.name ?? target.email,
      },
    });
  } catch (error) {
    console.error('Duel invite error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
