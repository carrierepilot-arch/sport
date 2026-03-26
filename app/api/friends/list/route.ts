import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const [accepted, received, sent] = await Promise.all([
      // Amis acceptés (je suis sender ou receiver)
      prisma.friendRequest.findMany({
        where: {
          status: 'accepted',
          OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
        },
        include: { sender: true, receiver: true },
      }),
      // Demandes reçues en attente
      prisma.friendRequest.findMany({
        where: { receiverId: payload.userId, status: 'pending' },
        include: { sender: true },
      }),
      // Demandes envoyées en attente
      prisma.friendRequest.findMany({
        where: { senderId: payload.userId, status: 'pending' },
        include: { receiver: true },
      }),
    ]);

    const amis = accepted.map((r) => {
      const friend = r.senderId === payload.userId ? r.receiver : r.sender;
      return { id: r.id, friendId: friend.id, pseudo: friend.pseudo ?? friend.email, nom: friend.name ?? friend.email, statut: 'accepte' as const };
    });

    const recus = received.map((r) => ({
      id: r.id,
      friendId: r.sender.id,
      pseudo: r.sender.pseudo ?? r.sender.email,
      nom: r.sender.name ?? r.sender.email,
      statut: 'recu' as const,
    }));

    const enAttente = sent.map((r) => ({
      id: r.id,
      friendId: r.receiver.id,
      pseudo: r.receiver.pseudo ?? r.receiver.email,
      nom: r.receiver.name ?? r.receiver.email,
      statut: 'en_attente' as const,
    }));

    return NextResponse.json({ amis, recus, enAttente });
  } catch (error) {
    console.error('List friends error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
