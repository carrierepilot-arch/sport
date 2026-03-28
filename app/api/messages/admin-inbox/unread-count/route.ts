import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });

    const adminIds = adminUsers.map((u) => u.id);
    if (adminIds.length === 0) {
      return NextResponse.json({ unreadCount: 0 });
    }

    const unreadCount = await prisma.message.count({
      where: {
        receiverId: payload.userId,
        read: false,
        senderId: { in: adminIds },
      },
    });

    return NextResponse.json({ unreadCount });
  } catch (error) {
    console.error('Admin inbox unread-count error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
