import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';
import { getProfileImageUrl } from '@/lib/social';
import { buildBotTestWhere } from '@/lib/bot-test-accounts';

// GET — list all bot/test accounts (level 3 only)
export async function GET(request: NextRequest) {
  try {
    const admin = await requireAdminPermission(request, 'users:write');
    if (!admin) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    if (admin.adminLevel < 3) return NextResponse.json({ error: 'Accès réservé au super-admin (niveau 3)' }, { status: 403 });

    const bots = await prisma.user.findMany({
      where: buildBotTestWhere(),
      select: {
        id: true,
        email: true,
        name: true,
        pseudo: true,
        level: true,
        xp: true,
        equipmentData: true,
        suspended: true,
        createdAt: true,
        _count: {
          select: {
            sentMessages: true,
            sentFriendRequests: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    return NextResponse.json({
      bots: bots.map((b) => ({
        id: b.id,
        email: b.email,
        name: b.name,
        pseudo: b.pseudo,
        level: b.level,
        xp: b.xp,
        suspended: b.suspended,
        createdAt: b.createdAt,
        profileImageUrl: getProfileImageUrl(b.equipmentData),
        _count: b._count,
      })),
    });
  } catch (err) {
    console.error('Bots list error:', err);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
