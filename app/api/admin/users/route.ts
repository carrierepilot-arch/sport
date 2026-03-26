import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function requireAdmin(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '');
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  const user = await prisma.user.findUnique({ where: { id: payload.userId } });
  if (!user?.isAdmin) return null;
  return payload;
}

export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdmin(request);
    if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

    const users = await prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        pseudo: true,
        isAdmin: true,
        suspended: true,
        level: true,
        createdAt: true,
        updatedAt: true,
        sessions: {
          orderBy: { lastSeen: 'desc' },
          take: 1,
          select: { lastSeen: true, browser: true, device: true, ipAddress: true, createdAt: true },
        },
        _count: {
          select: {
            sentMessages: true,
            sentFriendRequests: true,
            receivedFriendRequests: true,
            activityLogs: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({ users });
  } catch (error) {
    console.error('Admin users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
