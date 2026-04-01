import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ notifications: [] });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ notifications: [] });

    const rows = await prisma.suggestion.findMany({
      where: {
        userId: payload.userId,
        category: 'mention_notification',
        status: 'unread',
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const notifications = rows.map((r) => {
      // text format: mention:post:<postId>:from:<senderId>
      const parts = r.text.split(':');
      const postId = parts[2] ?? '';
      const fromId = parts[4] ?? '';
      return { id: r.id, postId, fromId, createdAt: r.createdAt };
    });

    return NextResponse.json({ notifications });
  } catch (error) {
    console.error('Mentions GET error:', error);
    return NextResponse.json({ notifications: [] });
  }
}

// Mark mention notifications as read
export async function PATCH(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ success: false }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ success: false }, { status: 401 });

    const { ids } = await request.json().catch(() => ({ ids: [] as string[] }));
    const where = {
      userId: payload.userId,
      category: 'mention_notification',
      ...(Array.isArray(ids) && ids.length ? { id: { in: ids as string[] } } : {}),
    };

    await prisma.suggestion.updateMany({ where, data: { status: 'read' } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mentions PATCH error:', error);
    return NextResponse.json({ success: false }, { status: 500 });
  }
}
