import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST — create a poll
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    question?: string;
    options?: string[];
  };

  const question = (body.question || '').trim();
  const options = (body.options || []).map((o: string) => o.trim()).filter(Boolean);

  if (!question || options.length < 2 || options.length > 6) {
    return NextResponse.json({ error: 'Question et 2-6 options requises' }, { status: 400 });
  }

  if (question.length > 280) {
    return NextResponse.json({ error: 'Question trop longue (280 max)' }, { status: 400 });
  }

  // Store poll as a special feed_post with __POLL__ prefix
  const pollData = JSON.stringify({ question, options, votes: {} });
  const post = await prisma.suggestion.create({
    data: {
      userId: payload.userId,
      category: 'feed_post',
      status: 'published',
      text: `__POLL__${pollData}`,
    },
  });

  return NextResponse.json({ success: true, postId: post.id });
}
