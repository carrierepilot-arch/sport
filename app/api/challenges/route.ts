import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

function getWeekBounds() {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const diffToMonday = (day === 0 ? -6 : 1 - day);
  const monday = new Date(now);
  monday.setDate(now.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return { monday, sunday };
}

const WEEKLY_CHALLENGES = [
  {
    title: '30 tractions en une semaine',
    description: 'Réalisez au total 30 tractions cette semaine, peu importe comment vous les répartissez.',
    exercise: 'tractions',
    target: 30,
    unit: 'reps',
    badgeCode: 'challenge_tractions_30',
    badgeLabel: '30 Tractions en une semaine',
  },
  {
    title: '100 pompes en une semaine',
    description: 'Totalisez 100 pompes cette semaine. Répartissez-les sur plusieurs séances.',
    exercise: 'pompes',
    target: 100,
    unit: 'reps',
    badgeCode: 'challenge_pompes_100',
    badgeLabel: '100 Pompes en une semaine',
  },
  {
    title: '50 dips en une semaine',
    description: 'Enchaînez 50 dips au total cette semaine.',
    exercise: 'dips',
    target: 50,
    unit: 'reps',
    badgeCode: 'challenge_dips_50',
    badgeLabel: '50 Dips en une semaine',
  },
];

// GET — active challenges for current week + user-created (own + friends) + completions
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { monday, sunday } = getWeekBounds();

    // Upsert this week's system challenges
    for (const c of WEEKLY_CHALLENGES) {
      await prisma.challenge.upsert({
        where: { id: `week_${monday.toISOString().slice(0, 10)}_${c.badgeCode}` },
        update: {},
        create: {
          id: `week_${monday.toISOString().slice(0, 10)}_${c.badgeCode}`,
          ...c,
          weekStart: monday,
          weekEnd: sunday,
          isPublic: true,
        },
      });
    }

    // Get friend IDs (accepted friendships)
    const friendships = await prisma.friendRequest.findMany({
      where: {
        status: 'accepte',
        OR: [{ senderId: payload.userId }, { receiverId: payload.userId }],
      },
      select: { senderId: true, receiverId: true },
    });
    const friendIds = friendships.map((f) =>
      f.senderId === payload.userId ? f.receiverId : f.senderId,
    );

    const [systemChallenges, userChallenges, approvedPublicChallenges] = await Promise.all([
      // System weekly challenges
      prisma.challenge.findMany({
        where: { isPublic: true, weekStart: monday },
        include: {
          completions: { where: { userId: payload.userId } },
          _count: { select: { completions: true } },
        },
      }),
      // User-created challenges (own + friends' visible + public)
      prisma.challenge.findMany({
        where: {
          OR: [
            // My own challenges (any visibility)
            { creatorId: payload.userId },
            // Friends' challenges with visibility 'friends' or 'public'
            { creatorId: { in: friendIds }, visibility: { in: ['friends', 'public'] } },
          ],
        },
        include: {
          creator: { select: { id: true, pseudo: true, name: true } },
          completions: { where: { userId: payload.userId } },
          _count: { select: { completions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
      // Admin-approved public challenges (from any user)
      prisma.challenge.findMany({
        where: {
          isPublic: true,
          adminApproved: true,
          creatorId: { not: null },
          weekStart: null,
        },
        include: {
          creator: { select: { id: true, pseudo: true, name: true } },
          completions: { where: { userId: payload.userId } },
          _count: { select: { completions: true } },
        },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    // Deduplicate (some user challenges might also be approved public)
    const seenIds = new Set<string>();
    const challenges: (typeof systemChallenges[0] & { type: 'system' | 'user' | 'public' })[] = [];
    for (const c of systemChallenges) {
      if (!seenIds.has(c.id)) { seenIds.add(c.id); (challenges as unknown[]).push({ ...c, type: 'system' }); }
    }
    for (const c of approvedPublicChallenges) {
      if (!seenIds.has(c.id)) { seenIds.add(c.id); (challenges as unknown[]).push({ ...c, type: 'public' }); }
    }
    for (const c of userChallenges) {
      if (!seenIds.has(c.id)) { seenIds.add(c.id); (challenges as unknown[]).push({ ...c, type: 'user' }); }
    }

    return NextResponse.json({ challenges });
  } catch (error) {
    console.error('Challenges GET error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// POST — action: 'complete' | 'create' | 'submit'
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const body = await request.json();
    const { action } = body;

    // ── Mark challenge as completed ──
    if (!action || action === 'complete') {
      const { challengeId } = body as { challengeId: string };
      if (!challengeId) return NextResponse.json({ error: 'challengeId requis' }, { status: 400 });

      const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
      if (!challenge) return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });

      const existing = await prisma.challengeCompletion.findUnique({
        where: { userId_challengeId: { userId: payload.userId, challengeId } },
      });
      if (existing) return NextResponse.json({ error: 'Défi déjà complété' }, { status: 409 });

      await prisma.challengeCompletion.create({
        data: { userId: payload.userId, challengeId },
      });

      // Award XP based on challenge difficulty (1=25, 2=50, 3=100)
      // Creator never earns XP on their own challenge
      const isCreator = challenge.creatorId === payload.userId;
      const xpReward = isCreator ? 0 : (challenge.difficulty === 3 ? 100 : challenge.difficulty === 2 ? 50 : 25);
      if (xpReward > 0) {
        await prisma.user.update({ where: { id: payload.userId }, data: { xp: { increment: xpReward } } });
      }

      // Award badge only for system challenges with a badgeCode
      if (challenge.badgeCode) {
        await prisma.badge.upsert({
          where: { userId_code: { userId: payload.userId, code: challenge.badgeCode } },
          update: {},
          create: {
            userId: payload.userId,
            code: challenge.badgeCode,
            label: challenge.badgeLabel || challenge.title,
          },
        });
      }

      return NextResponse.json({ ok: true, badgeLabel: challenge.badgeLabel || null });
    }

    // ── Create a custom challenge ──
    if (action === 'create') {
      const { title, description, exercise, target, unit, challengeType, circuitData, difficulty, visibility } = body as {
        title: string; description: string; exercise: string; target: number; unit: string;
        challengeType?: string; circuitData?: { exercises: { nom: string; reps: number }[]; repos: number; tours: number };
        difficulty?: number; visibility?: string;
      };
      if (!title || !description) {
        return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
      }
      if (challengeType === 'circuit') {
        if (!circuitData?.exercises?.length || !circuitData.tours) {
          return NextResponse.json({ error: 'Données du circuit manquantes' }, { status: 400 });
        }
      } else {
        if (!exercise || !target) {
          return NextResponse.json({ error: 'Champs manquants' }, { status: 400 });
        }
      }

      const challenge = await prisma.challenge.create({
        data: {
          title,
          description,
          exercise: exercise || 'circuit',
          target: Number(target) || circuitData?.tours || 0,
          unit: unit || 'reps',
          badgeCode: '',
          badgeLabel: '',
          creatorId: payload.userId,
          isPublic: false,
          visibility: ['friends', 'private', 'public'].includes(visibility || '') ? visibility! : 'friends',
          challengeType: challengeType || 'simple',
          difficulty: Math.min(3, Math.max(1, Number(difficulty) || 1)),
          circuitData: circuitData ? (circuitData as object) : undefined,
        },
        include: { creator: { select: { id: true, pseudo: true, name: true } } },
      });

      return NextResponse.json({ challenge });
    }

    // ── Submit for admin review ──
    if (action === 'submit') {
      const { challengeId } = body as { challengeId: string };
      if (!challengeId) return NextResponse.json({ error: 'challengeId requis' }, { status: 400 });

      const challenge = await prisma.challenge.findUnique({ where: { id: challengeId } });
      if (!challenge) return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
      if (challenge.creatorId !== payload.userId) {
        return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
      }

      await prisma.challenge.update({
        where: { id: challengeId },
        data: { submittedForReview: true },
      });

      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'action invalide' }, { status: 400 });
  } catch (error) {
    console.error('Challenge POST error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

