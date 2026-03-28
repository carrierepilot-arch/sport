import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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
    const post = await prisma.suggestion.findUnique({ where: { id: postId } });
    if (!post || post.category !== 'feed_post' || post.status !== 'published') {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 });
    }

    const me = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { isAdmin: true },
    });

    const canDelete = post.userId === payload.userId || me?.isAdmin === true;
    if (!canDelete) {
      return NextResponse.json({ error: 'Action interdite' }, { status: 403 });
    }

    await prisma.suggestion.deleteMany({
      where: {
        OR: [
          { category: 'feed_like', text: `post:${postId}` },
          { category: 'feed_reply', text: { startsWith: `post:${postId}\n` } },
        ],
      },
    });

    await prisma.suggestion.delete({ where: { id: postId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Feed DELETE error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
