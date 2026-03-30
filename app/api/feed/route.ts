import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl, getProfileVisibility } from '@/lib/social';

function getToken(request: NextRequest): string | null {
  const auth = request.headers.get('authorization');
  return auth?.replace('Bearer ', '') ?? null;
}

function parseReplyText(text: string): { postId: string; content: string } | null {
  if (!text.startsWith('post:')) return null;
  const sep = text.indexOf('\n');
  if (sep <= 5) return null;
  const postId = text.slice(5, sep).trim();
  const content = text.slice(sep + 1).trim();
  if (!postId || !content) return null;
  return { postId, content };
}

function extractFeedBodyText(text: string): string {
  if (text.startsWith('__IMAGE__') || text.startsWith('__VIDEO__')) {
    const separatorIndex = text.indexOf('\n');
    if (separatorIndex >= 0) return text.slice(separatorIndex + 1).trim();
    return '';
  }
  return text.trim();
}

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const viewer = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true },
    });

    const scope = request.nextUrl.searchParams.get('scope') === 'friends' ? 'friends' : 'all';

    const accepted = await prisma.friendRequest.findMany({
      where: {
        status: 'accepted',
        OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
      },
      select: { senderId: true, receiverId: true },
    });
    const friendIds = accepted.map((f) => (f.senderId === payload.userId ? f.receiverId : f.senderId));

    const feedItems = await prisma.suggestion.findMany({
      where: {
        category: 'feed_post',
        status: 'published',
        ...(scope === 'friends' ? { userId: { in: [payload.userId, ...friendIds] } } : {}),
      },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        user: {
          select: { id: true, pseudo: true, name: true, email: true, equipmentData: true },
        },
      },
    });

    const postKeys = feedItems.map((item) => `post:${item.id}`);

    const authorIds = Array.from(new Set(feedItems.map((item) => item.user?.id).filter(Boolean))) as string[];

    const [likes, replyRows, followedRows] = await Promise.all([
      postKeys.length
        ? prisma.suggestion.findMany({
            where: {
              category: 'feed_like',
              status: 'active',
              text: { in: postKeys },
            },
            select: { id: true, text: true, userId: true },
          })
        : Promise.resolve([]),
      prisma.suggestion.findMany({
        where: { category: 'feed_reply', status: 'published' },
        orderBy: { createdAt: 'desc' },
        take: 500,
        include: {
          user: {
            select: { id: true, pseudo: true, name: true, email: true, equipmentData: true },
          },
        },
      }),
      prisma.suggestion.findMany({
        where: { category: 'follow_user', status: 'active', userId: payload.userId, text: { in: authorIds } },
        select: { text: true },
      }),
    ]);

    const likeCountByPost = new Map<string, number>();
    const likedByMe = new Set<string>();
    const followedAuthors = new Set(followedRows.map((row) => row.text));
    const directFriends = new Set(friendIds);

    for (const like of likes) {
      const postId = like.text.replace(/^post:/, '');
      likeCountByPost.set(postId, (likeCountByPost.get(postId) || 0) + 1);
      if (like.userId === payload.userId) likedByMe.add(postId);
    }

    const visibleFeedItems = feedItems.filter((item) => {
      const authorId = item.user?.id;
      if (!authorId) return false;
      const visibility = getProfileVisibility(item.user?.equipmentData);
      if (visibility === 'public') return true;
      if (authorId === payload.userId) return true;
      if (followedAuthors.has(authorId)) return true;
      if (directFriends.has(authorId)) return true;
      if (viewer?.isAdmin) return true;
      return false;
    });

    const feedPostIds = new Set(visibleFeedItems.map((p) => p.id));
    const repliesByPost = new Map<string, Array<{ id: string; content: string; createdAt: Date; author: { id: string; pseudo: string } }>>();

    for (const row of replyRows) {
      const parsed = parseReplyText(row.text);
      if (!parsed || !feedPostIds.has(parsed.postId)) continue;
      const list = repliesByPost.get(parsed.postId) || [];
      list.push({
        id: row.id,
        content: parsed.content,
        createdAt: row.createdAt,
        author: {
          id: row.user?.id ?? 'unknown',
          pseudo: row.user?.pseudo ?? row.user?.name ?? row.user?.email ?? 'Utilisateur',
        },
      });
      repliesByPost.set(parsed.postId, list);
    }

    const scoredPosts = visibleFeedItems.map((item) => {
      const authorId = item.user?.id ?? 'unknown';
      const replies = (repliesByPost.get(item.id) || [])
        .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
        .slice(-3)
        .map((r) => ({
          id: r.id,
          content: r.content,
          createdAt: r.createdAt,
          author: r.author,
        }));
      const likeCount = likeCountByPost.get(item.id) || 0;
      const ageHours = (Date.now() - item.createdAt.getTime()) / 3600000;
      const recencyBoost = Math.max(0, 180 - ageHours * 22);
      const likesBoost = Math.min(70, likeCount * 8);
      const repliesBoost = Math.min(70, replies.length * 10);
      const velocityBoost = ageHours <= 3 ? Math.min(40, likeCount * 6 + replies.length * 8) : 0;
      const followedBoost = followedAuthors.has(authorId) ? 12 : 0;
      const reasons = [
        ...(ageHours <= 6 ? ['Recent'] : []),
        ...(followedAuthors.has(authorId) ? ['Suivi'] : []),
        ...((likeCount >= 3 || replies.length >= 2) ? ['Tendance'] : []),
      ];
      const recencyBand = Math.floor(item.createdAt.getTime() / (45 * 60 * 1000));
      return {
        id: item.id,
        content: item.text,
        createdAt: item.createdAt,
        author: {
          id: authorId,
          pseudo: item.user?.pseudo ?? item.user?.name ?? item.user?.email ?? 'Utilisateur',
          profileImageUrl: getProfileImageUrl(item.user?.equipmentData),
        },
        likeCount,
        likedByMe: likedByMe.has(item.id),
        replyCount: replies.length,
        replies,
        feedScore: Math.round(recencyBoost + likesBoost + repliesBoost + velocityBoost + followedBoost),
        recencyBand,
        rankingReasons: reasons,
      };
    });

    scoredPosts.sort((left, right) => {
      if (right.recencyBand !== left.recencyBand) return right.recencyBand - left.recencyBand;
      if (right.feedScore !== left.feedScore) return right.feedScore - left.feedScore;
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });

    return NextResponse.json({
      posts: scoredPosts,
      me: payload.userId,
      scope,
    });
  } catch (error) {
    console.error('Feed GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const contentRaw = typeof body.content === 'string' ? body.content : '';
    const content = contentRaw.trim();
    const textOnly = extractFeedBodyText(content);

    if (!content) {
      return NextResponse.json({ error: 'Le message est vide' }, { status: 400 });
    }
    if (textOnly.length > 280) {
      return NextResponse.json({ error: '280 caracteres maximum' }, { status: 400 });
    }

    const created = await prisma.suggestion.create({
      data: {
        userId: payload.userId,
        text: content,
        category: 'feed_post',
        status: 'published',
      },
      include: {
        user: {
          select: { id: true, pseudo: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      post: {
        id: created.id,
        content: created.text,
        createdAt: created.createdAt,
        author: {
          id: created.user?.id ?? payload.userId,
          pseudo: created.user?.pseudo ?? created.user?.name ?? created.user?.email ?? 'Utilisateur',
        },
        likeCount: 0,
        likedByMe: false,
        replyCount: 0,
        replies: [],
      },
    });
  } catch (error) {
    console.error('Feed POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
