import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl, isVerifiedUser } from '@/lib/social';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const statusFilter = request.nextUrl.searchParams.get('status') === 'validated' ? 'validated' : 'pending';
    const rows = await prisma.performance.findMany({
      where: { status: statusFilter, videoUrl: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 20,
      include: {
        user: { select: { id: true, pseudo: true, name: true, level: true, xp: true, isAdmin: true } },
        spot: { select: { id: true, name: true, city: true } },
        validations: { select: { validatorId: true, status: true } },
      },
    });

    const authorIds = Array.from(new Set(rows.map((row) => row.userId)));
    const followerRows = authorIds.length
      ? await prisma.suggestion.findMany({
          where: { category: 'follow_user', status: 'active', text: { in: authorIds } },
          select: { text: true },
        })
      : [];
    const followerCountByUserId = new Map<string, number>();
    for (const row of followerRows) {
      followerCountByUserId.set(row.text, (followerCountByUserId.get(row.text) ?? 0) + 1);
    }

    const validatedCountByUserId = new Map<string, number>();
    for (const row of rows) {
      if (row.status !== 'validated') continue;
      validatedCountByUserId.set(row.userId, (validatedCountByUserId.get(row.userId) ?? 0) + 1);
    }

    return NextResponse.json({
      performances: rows.map((row) => {
        const accepted = row.validations.filter((item) => item.status === 'accepted').length;
        const rejected = row.validations.filter((item) => item.status === 'rejected').length;
        const myVote = row.validations.find((item) => item.validatorId === payload.userId)?.status ?? null;
        return {
          id: row.id,
          exercise: row.exercise,
          score: row.score,
          unit: row.unit,
          status: row.status,
          videoUrl: row.videoUrl,
          createdAt: row.createdAt,
          validationQuestion: 'Les repetitions sont-elles valides ?',
          canVote: row.userId !== payload.userId,
          validation: {
            accepted,
            rejected,
            total: accepted + rejected,
            myVote,
          },
          author: {
            id: row.user.id,
            pseudo: row.user.pseudo ?? row.user.name ?? 'Athlete',
            level: row.user.level ?? 'intermediaire',
            xp: row.user.xp ?? 0,
            profileImageUrl: getProfileImageUrl((row.user as unknown as { equipmentData?: unknown }).equipmentData),
            verified: isVerifiedUser(
              row.user,
              followerCountByUserId.get(row.user.id) ?? 0,
              validatedCountByUserId.get(row.user.id) ?? 0,
            ),
          },
          spot: row.spot,
        };
      }),
    });
  } catch (error) {
    console.error('Community performances error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
