import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// POST — vote on a poll
export async function POST(request: NextRequest) {
  const token = request.headers.get('authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
  const payload = verifyToken(token);
  if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

  const body = await request.json().catch(() => ({})) as {
    pollId?: string;
    optionIndex?: number;
  };

  if (!body.pollId || typeof body.optionIndex !== 'number') {
    return NextResponse.json({ error: 'pollId et optionIndex requis' }, { status: 400 });
  }

  const post = await prisma.suggestion.findUnique({ where: { id: body.pollId } });
  if (!post || !post.text.startsWith('__POLL__')) {
    return NextResponse.json({ error: 'Sondage introuvable' }, { status: 404 });
  }

  try {
    const pollData = JSON.parse(post.text.slice(8)) as {
      question: string;
      options: string[];
      votes: Record<string, number>;
    };

    if (body.optionIndex < 0 || body.optionIndex >= pollData.options.length) {
      return NextResponse.json({ error: 'Option invalide' }, { status: 400 });
    }

    // One vote per user — overwrite previous vote
    pollData.votes[payload.userId] = body.optionIndex;

    await prisma.suggestion.update({
      where: { id: body.pollId },
      data: { text: `__POLL__${JSON.stringify(pollData)}` },
    });

    // Calculate results
    const results = pollData.options.map((_, i) =>
      Object.values(pollData.votes).filter((v) => v === i).length
    );
    const totalVotes = Object.keys(pollData.votes).length;

    return NextResponse.json({
      success: true,
      results,
      totalVotes,
      myVote: body.optionIndex,
    });
  } catch {
    return NextResponse.json({ error: 'Erreur de traitement du sondage' }, { status: 500 });
  }
}
