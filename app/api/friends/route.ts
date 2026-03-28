import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const accepted = await prisma.friendRequest.findMany({
      where: {
        status: { in: ['accepted', 'accepte'] },
        OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
      },
      select: { senderId: true, receiverId: true, updatedAt: true },
      orderBy: { updatedAt: 'desc' },
    });

    const friendIds = accepted.map((r) => (r.senderId === payload.userId ? r.receiverId : r.senderId));
    const users = friendIds.length
      ? await prisma.user.findMany({
          where: { id: { in: friendIds } },
          select: { id: true, pseudo: true, name: true, email: true },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const friends = accepted.map((r) => {
      const friendId = r.senderId === payload.userId ? r.receiverId : r.senderId;
      const friend = userMap.get(friendId);
      return {
        id: friendId,
        pseudo: friend?.pseudo ?? friend?.name ?? friend?.email ?? 'ami',
      };
    });

    return NextResponse.json({ friends });
  } catch (error) {
    console.error('Friends route error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
