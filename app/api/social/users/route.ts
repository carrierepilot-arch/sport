import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { buildCountMap, getFollowRows, getFollowingRows, getProfileImageUrl, getProfileVisibility, isVerifiedUser } from '@/lib/social';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const searchQuery = request.nextUrl.searchParams.get('query')?.trim() ?? '';

    const users = await prisma.user.findMany({
      take: 18,
      where: searchQuery
        ? {
            OR: [
              { pseudo: { contains: searchQuery, mode: 'insensitive' } },
              { name: { contains: searchQuery, mode: 'insensitive' } },
            ],
          }
        : undefined,
      orderBy: [{ xp: 'desc' }, { createdAt: 'desc' }],
      select: {
        id: true,
        pseudo: true,
        name: true,
        level: true,
        xp: true,
        isAdmin: true,
        equipmentData: true,
      },
    });

    const userIds = users.map((user) => user.id);
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [followerRows, followingRows, postRows, performanceRows, weeklySessions] = await Promise.all([
      getFollowRows(userIds),
      getFollowingRows(userIds),
      prisma.suggestion.findMany({
        where: { category: 'feed_post', status: 'published', userId: { in: userIds } },
        select: { userId: true },
      }),
      prisma.performance.findMany({
        where: { userId: { in: userIds }, status: 'validated' },
        select: { userId: true, score: true, exercise: true, unit: true },
      }),
      prisma.workoutSession.findMany({
        where: { userId: { in: userIds }, status: { in: ['completed', 'done'] }, createdAt: { gte: weekAgo } },
        select: { userId: true },
      }),
    ]);

    const followersByUserId = buildCountMap(followerRows.map((row) => row.text));
    const followingByUserId = buildCountMap(followingRows.map((row) => row.userId));
    const postsByUserId = buildCountMap(postRows.map((row) => row.userId));
    const validatedByUserId = buildCountMap(performanceRows.map((row) => row.userId));
    const weeklySessionsByUserId = buildCountMap(weeklySessions.map((row) => row.userId));
    const followedByMe = new Set(
      followerRows.filter((row) => row.userId === payload.userId).map((row) => row.text),
    );

    const bestPerformanceByUserId = new Map<string, { exercise: string; score: number; unit: string }>();
    for (const perf of performanceRows) {
      const prev = bestPerformanceByUserId.get(perf.userId);
      if (!prev || perf.score > prev.score) {
        bestPerformanceByUserId.set(perf.userId, {
          exercise: perf.exercise,
          score: perf.score,
          unit: perf.unit,
        });
      }
    }

    const socialUsers = users
      .filter((user) => user.id !== payload.userId)
      .map((user) => {
        const followersCount = followersByUserId.get(user.id) ?? 0;
        const validatedPerformanceCount = validatedByUserId.get(user.id) ?? 0;
        const visibility = getProfileVisibility(user.equipmentData);
        const isPrivate = visibility === 'private' && !followedByMe.has(user.id);
        return {
          id: user.id,
          pseudo: user.pseudo ?? user.name ?? 'Athlete',
          name: user.name ?? null,
          level: user.level ?? 'intermediaire',
          xp: user.xp ?? 0,
          profileImageUrl: getProfileImageUrl(user.equipmentData),
          profileVisibility: visibility,
          isPrivate,
          verified: isVerifiedUser(user, followersCount, validatedPerformanceCount),
          followedByMe: followedByMe.has(user.id),
          counts: {
            followers: followersCount,
            following: followingByUserId.get(user.id) ?? 0,
            posts: isPrivate ? 0 : (postsByUserId.get(user.id) ?? 0),
            validatedPerformances: isPrivate ? 0 : validatedPerformanceCount,
            weeklySessions: isPrivate ? 0 : (weeklySessionsByUserId.get(user.id) ?? 0),
          },
          bestPerformance: isPrivate ? null : (bestPerformanceByUserId.get(user.id) ?? null),
        };
      });

    return NextResponse.json({ users: socialUsers });
  } catch (error) {
    console.error('Social users error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
