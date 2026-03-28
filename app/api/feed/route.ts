import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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

export async function GET(request: NextRequest) {
  try {
    const token = getToken(request);
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const scope = request.nextUrl.searchParams.get('scope') === 'friends' ? 'friends' : 'all';

    let friendIds: string[] = [];
    if (scope === 'friends') {
      const accepted = await prisma.friendRequest.findMany({
        where: {
          status: 'accepted',
          OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
        },
        select: { senderId: true, receiverId: true },
      });
      friendIds = accepted.map((f) => (f.senderId === payload.userId ? f.receiverId : f.senderId));
    }

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
          select: { id: true, pseudo: true, name: true, email: true },
        },
      },
    });

    const postKeys = feedItems.map((item) => `post:${item.id}`);

    const [likes, replyRows] = await Promise.all([
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
            select: { id: true, pseudo: true, name: true, email: true },
          },
        },
      }),
    ]);

    const likeCountByPost = new Map<string, number>();
    const likedByMe = new Set<string>();

    for (const like of likes) {
      const postId = like.text.replace(/^post:/, '');
      likeCountByPost.set(postId, (likeCountByPost.get(postId) || 0) + 1);
      if (like.userId === payload.userId) likedByMe.add(postId);
    }

    const feedPostIds = new Set(feedItems.map((p) => p.id));
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

    return NextResponse.json({
      posts: feedItems.map((item) => ({
        id: item.id,
        content: item.text,
        createdAt: item.createdAt,
        author: {
          id: item.user?.id ?? 'unknown',
          pseudo: item.user?.pseudo ?? item.user?.name ?? item.user?.email ?? 'Utilisateur',
        },
        likeCount: likeCountByPost.get(item.id) || 0,
        likedByMe: likedByMe.has(item.id),
        replyCount: (repliesByPost.get(item.id) || []).length,
        replies: (repliesByPost.get(item.id) || [])
          .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime())
          .slice(-3)
          .map((r) => ({
            id: r.id,
            content: r.content,
            createdAt: r.createdAt,
            author: r.author,
          })),
      })),
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

    if (!content) {
      return NextResponse.json({ error: 'Le message est vide' }, { status: 400 });
    }
    if (content.length > 280) {
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
