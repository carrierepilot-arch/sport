import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

async function getPost(postId: string) {
  return prisma.suggestion.findUnique({ where: { id: postId } });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { postId } = await params;
    const post = await getPost(postId);
    if (!post || post.category !== 'feed_post' || post.status !== 'published') {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 });
    }

    const existing = await prisma.suggestion.findFirst({
      where: {
        category: 'feed_like',
        status: 'active',
        userId: payload.userId,
        text: `post:${postId}`,
      },
      select: { id: true },
    });

    if (!existing) {
      await prisma.suggestion.create({
        data: {
          userId: payload.userId,
          category: 'feed_like',
          status: 'active',
          text: `post:${postId}`,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feed like POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { postId } = await params;

    await prisma.suggestion.deleteMany({
      where: {
        category: 'feed_like',
        status: 'active',
        userId: payload.userId,
        text: `post:${postId}`,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feed like DELETE error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
