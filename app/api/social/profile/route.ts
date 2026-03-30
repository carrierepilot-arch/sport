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

    const requestedUserId = request.nextUrl.searchParams.get('userId')?.trim() || payload.userId;
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [viewer, user, followerRows, followingRows, posts, badges, weeklySessions, performances, followedByMeRows, friendshipRows] = await Promise.all([
      prisma.user.findUnique({ where: { id: payload.userId }, select: { id: true, isAdmin: true } }),
      prisma.user.findUnique({
        where: { id: requestedUserId },
        select: { id: true, pseudo: true, name: true, email: true, level: true, xp: true, isAdmin: true, equipmentData: true },
      }),
      getFollowRows([requestedUserId]),
      getFollowingRows([requestedUserId]),
      prisma.suggestion.findMany({
        where: { category: 'feed_post', status: 'published', userId: requestedUserId },
        orderBy: { createdAt: 'desc' },
        take: 12,
        select: { id: true, text: true, createdAt: true },
      }),
      prisma.badge.findMany({
        where: { userId: requestedUserId },
        orderBy: { earnedAt: 'desc' },
        take: 6,
        select: { id: true, code: true, label: true, earnedAt: true },
      }),
      prisma.workoutSession.count({
        where: { userId: requestedUserId, status: { in: ['completed', 'done'] }, createdAt: { gte: weekAgo } },
      }),
      prisma.performance.findMany({
        where: { userId: requestedUserId, status: 'validated' },
        include: { spot: { select: { name: true, city: true } } },
        orderBy: [{ score: 'desc' }, { createdAt: 'desc' }],
        take: 12,
      }),
      prisma.suggestion.findMany({
        where: { category: 'follow_user', status: 'active', userId: payload.userId, text: requestedUserId },
        select: { id: true },
      }),
      prisma.friendRequest.findMany({
        where: {
          status: 'accepted',
          OR: [
            { senderId: payload.userId, receiverId: requestedUserId },
            { senderId: requestedUserId, receiverId: payload.userId },
          ],
        },
        select: { id: true },
      }),
    ]);

    if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    const followersCount = followerRows.length;
    const followingCount = followingRows.length;
    const performanceCount = performances.length;
    const visibility = getProfileVisibility(user.equipmentData);
    const isMe = requestedUserId === payload.userId;
    const followedByMe = followedByMeRows.length > 0;
    const isFriend = friendshipRows.length > 0;
    const canViewPrivateProfile = isMe || followedByMe || isFriend || Boolean(viewer?.isAdmin);
    const isPrivateForViewer = visibility === 'private' && !canViewPrivateProfile;
    const bestByExercise = new Map<string, { exercise: string; score: number; unit: string; spotName: string; spotCity: string | null }>();
    for (const performance of performances) {
      if (!bestByExercise.has(performance.exercise)) {
        bestByExercise.set(performance.exercise, {
          exercise: performance.exercise,
          score: performance.score,
          unit: performance.unit,
          spotName: performance.spot?.name ?? 'Sans lieu',
          spotCity: performance.spot?.city ?? null,
        });
      }
    }

    const weeklyPostMap = buildCountMap(posts.map(() => requestedUserId));

    return NextResponse.json({
      profile: {
        id: user.id,
        pseudo: user.pseudo ?? user.name ?? user.email,
        name: user.name,
        profileImageUrl: getProfileImageUrl(user.equipmentData),
        profileVisibility: visibility,
        isPrivate: isPrivateForViewer,
        level: user.level ?? 'intermediaire',
        xp: user.xp ?? 0,
        verified: isVerifiedUser(user, followersCount, performanceCount),
        isMe,
        followedByMe,
        counts: {
          followers: followersCount,
          following: followingCount,
          posts: isPrivateForViewer ? 0 : posts.length,
          weeklyPosts: isPrivateForViewer ? 0 : (weeklyPostMap.get(requestedUserId) ?? 0),
          weeklySessions: isPrivateForViewer ? 0 : weeklySessions,
          badges: isPrivateForViewer ? 0 : badges.length,
          validatedPerformances: isPrivateForViewer ? 0 : performanceCount,
        },
        recentPosts: isPrivateForViewer ? [] : posts,
        recentBadges: isPrivateForViewer ? [] : badges,
        recentPerformances: isPrivateForViewer
          ? []
          : performances.map((performance) => ({
              id: performance.id,
              exercise: performance.exercise,
              score: performance.score,
              unit: performance.unit,
              videoUrl: performance.videoUrl,
              createdAt: performance.createdAt,
              spotName: performance.spot?.name ?? 'Sans lieu',
              spotCity: performance.spot?.city ?? null,
            })),
        bestPerformances: isPrivateForViewer ? [] : Array.from(bestByExercise.values()).slice(0, 4),
      },
    });
  } catch (error) {
    console.error('Social profile error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
