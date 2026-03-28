import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getToken(request: NextRequest): string | null {
  const authHeader = request.headers.get('authorization');
  return authHeader?.replace('Bearer ', '') ?? null;
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true, email: true, name: true, pseudo: true, adminLevel: true },
    });

    const adminIds = adminUsers.map((u) => u.id);
    if (adminIds.length === 0) {
      return NextResponse.json({ messages: [], unreadCount: 0 });
    }

    const adminById = new Map(adminUsers.map((u) => [u.id, u]));

    const [messages, unreadCount] = await Promise.all([
      prisma.message.findMany({
        where: {
          receiverId: payload.userId,
          senderId: { in: adminIds },
        },
        orderBy: { createdAt: 'desc' },
        take: 100,
      }),
      prisma.message.count({
        where: {
          receiverId: payload.userId,
          read: false,
          senderId: { in: adminIds },
        },
      }),
    ]);

    const data = messages.map((m) => {
      const sender = adminById.get(m.senderId);
      return {
        id: m.id,
        content: m.content,
        read: m.read,
        createdAt: m.createdAt,
        heure: new Date(m.createdAt).toLocaleString('fr-FR', {
          day: '2-digit',
          month: '2-digit',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        }),
        sender: {
          id: m.senderId,
          display: sender?.pseudo ?? sender?.name ?? sender?.email ?? 'Admin',
          adminLevel: sender?.adminLevel ?? 0,
        },
      };
    });

    return NextResponse.json({ messages: data, unreadCount });
  } catch (error) {
    console.error('Admin inbox GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const markAll = body?.markAll === true;
    const messageId = typeof body?.messageId === 'string' ? body.messageId : null;

    if (!markAll && !messageId) {
      return NextResponse.json({ error: 'messageId ou markAll=true requis' }, { status: 400 });
    }

    const adminUsers = await prisma.user.findMany({
      where: { isAdmin: true },
      select: { id: true },
    });
    const adminIds = adminUsers.map((u) => u.id);

    if (adminIds.length === 0) {
      return NextResponse.json({ success: true, updated: 0 });
    }

    if (markAll) {
      const updated = await prisma.message.updateMany({
        where: {
          receiverId: payload.userId,
          read: false,
          senderId: { in: adminIds },
        },
        data: { read: true },
      });
      return NextResponse.json({ success: true, updated: updated.count });
    }

    const updated = await prisma.message.updateMany({
      where: {
        id: messageId!,
        receiverId: payload.userId,
        read: false,
        senderId: { in: adminIds },
      },
      data: { read: true },
    });

    return NextResponse.json({ success: true, updated: updated.count });
  } catch (error) {
    console.error('Admin inbox PATCH error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
