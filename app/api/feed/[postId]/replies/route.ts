import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

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
    const post = await prisma.suggestion.findUnique({ where: { id: postId } });
    if (!post || post.category !== 'feed_post' || post.status !== 'published') {
      return NextResponse.json({ error: 'Post introuvable' }, { status: 404 });
    }

    const body = await request.json().catch(() => ({}));
    const contentRaw = typeof body.content === 'string' ? body.content : '';
    const content = contentRaw.trim();

    if (!content) {
      return NextResponse.json({ error: 'Reponse vide' }, { status: 400 });
    }
    if (content.length > 280) {
      return NextResponse.json({ error: '280 caracteres maximum' }, { status: 400 });
    }

    const created = await prisma.suggestion.create({
      data: {
        userId: payload.userId,
        category: 'feed_reply',
        status: 'published',
        text: `post:${postId}\n${content}`,
      },
      include: {
        user: {
          select: { id: true, pseudo: true, name: true, email: true },
        },
      },
    });

    return NextResponse.json({
      success: true,
      reply: {
        id: created.id,
        content,
        createdAt: created.createdAt,
        author: {
          id: created.user?.id ?? payload.userId,
          pseudo: created.user?.pseudo ?? created.user?.name ?? created.user?.email ?? 'Utilisateur',
        },
      },
    });
  } catch (error) {
    console.error('Feed reply POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
