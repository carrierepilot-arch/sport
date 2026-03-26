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

    // Tous les messages impliquant cet utilisateur, groupés par interlocuteur
    const messages = await prisma.message.findMany({
      where: {
        OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
      },
      include: { sender: true, receiver: true },
      orderBy: { createdAt: 'desc' },
    });

    // Dédupliquer par interlocuteur, garder le dernier message
    const convMap = new Map<string, {
      friendId: string; pseudo: string; nom: string; dernier: string; heure: string; nonLu: number;
    }>();

    for (const msg of messages) {
      const friend = msg.senderId === payload.userId ? msg.receiver : msg.sender;
      if (!convMap.has(friend.id)) {
        const nonLu = messages.filter(
          (m) => m.senderId === friend.id && m.receiverId === payload.userId && !m.read
        ).length;
        convMap.set(friend.id, {
          friendId: friend.id,
          pseudo: friend.pseudo ?? friend.email,
          nom: friend.name ?? friend.email,
          dernier: msg.content.slice(0, 50) + (msg.content.length > 50 ? '...' : ''),
          heure: new Date(msg.createdAt).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' }),
          nonLu,
        });
      }
    }

    return NextResponse.json({ conversations: Array.from(convMap.values()) });
  } catch (error) {
    console.error('List conversations error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
