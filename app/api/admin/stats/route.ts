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

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [
      totalUsers,
      totalMessages,
      totalFriendships,
      pendingFriendRequests,
      usersWithPseudo,
      newUsersThisWeek,
      recentSessions,
      recentRegistrations,
      recentMessages,
      allUsers,
    ] = await Promise.all([
      prisma.user.count(),
      prisma.message.count(),
      prisma.friendRequest.count({ where: { status: 'accepted' } }),
      prisma.friendRequest.count({ where: { status: 'pending' } }),
      prisma.user.count({ where: { pseudo: { not: null } } }),
      prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
      prisma.userSession.findMany({
        orderBy: { lastSeen: 'desc' },
        take: 20,
        include: { user: { select: { email: true, name: true, pseudo: true } } },
      }),
      prisma.user.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.message.findMany({
        where: { createdAt: { gte: sevenDaysAgo } },
        select: { createdAt: true },
        orderBy: { createdAt: 'asc' },
      }),
      prisma.user.findMany({
        select: {
          email: true,
          name: true,
          pseudo: true,
          _count: { select: { sentMessages: true, sentFriendRequests: true } },
        },
      }),
    ]);

    // Tendances des 7 derniers jours (inscriptions + messages)
    const days: { label: string; date: string }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
      days.push({
        date: d.toISOString().slice(0, 10),
        label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
      });
    }

    const registrationsByDay = days.map(({ label, date }) => ({
      label,
      count: recentRegistrations.filter((u) => u.createdAt.toISOString().slice(0, 10) === date).length,
    }));

    const messagesByDay = days.map(({ label, date }) => ({
      label,
      count: recentMessages.filter((m) => m.createdAt.toISOString().slice(0, 10) === date).length,
    }));

    // Top 5 utilisateurs par messages envoyés
    const topUsers = [...allUsers]
      .sort((a, b) => b._count.sentMessages - a._count.sentMessages)
      .slice(0, 5)
      .map((u) => ({
        display: u.pseudo ?? u.name ?? u.email,
        email: u.email,
        messages: u._count.sentMessages,
        friendRequests: u._count.sentFriendRequests,
      }));

    return NextResponse.json({
      stats: {
        totalUsers,
        totalMessages,
        totalFriendships,
        pendingFriendRequests,
        usersWithPseudo,
        newUsersThisWeek,
      },
      recentSessions,
      registrationsByDay,
      messagesByDay,
      topUsers,
    });
  } catch (error) {
    console.error('Admin stats error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
