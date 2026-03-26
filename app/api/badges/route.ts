import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Badge definitions
const BADGE_DEFS: { code: string; label: string; check: (ctx: BadgeContext) => boolean }[] = [
  // Sessions
  { code: 'first_session', label: 'Première séance terminée', check: (c) => c.completedSessions >= 1 },
  { code: '5_sessions', label: '5 séances réalisées', check: (c) => c.completedSessions >= 5 },
  { code: '10_sessions', label: '10 séances réalisées', check: (c) => c.completedSessions >= 10 },
  { code: '25_sessions', label: '25 séances réalisées', check: (c) => c.completedSessions >= 25 },
  { code: '50_sessions', label: '50 séances réalisées', check: (c) => c.completedSessions >= 50 },
  { code: '100_sessions', label: '100 séances réalisées', check: (c) => c.completedSessions >= 100 },
  // Streaks
  { code: 'streak_7', label: '7 jours consécutifs', check: (c) => c.loginStreak >= 7 },
  { code: 'streak_14', label: '14 jours consécutifs', check: (c) => c.loginStreak >= 14 },
  { code: 'streak_30', label: '30 jours consécutifs', check: (c) => c.loginStreak >= 30 },
  { code: 'streak_60', label: '60 jours consécutifs', check: (c) => c.loginStreak >= 60 },
  { code: 'streak_90', label: '90 jours consécutifs', check: (c) => c.loginStreak >= 90 },
  // Social
  { code: 'social', label: '5 amis ajoutés', check: (c) => c.friendCount >= 5 },
  { code: 'social_10', label: '10 amis ajoutés', check: (c) => c.friendCount >= 10 },
  { code: 'social_25', label: '25 amis ajoutés', check: (c) => c.friendCount >= 25 },
  { code: 'messenger', label: '50 messages envoyés', check: (c) => c.messagesSent >= 50 },
  { code: 'messenger_200', label: '200 messages envoyés', check: (c) => c.messagesSent >= 200 },
  // Workouts
  { code: 'first_workout', label: 'Premier programme créé', check: (c) => c.workoutsCreated >= 1 },
  { code: '5_workouts', label: '5 programmes créés', check: (c) => c.workoutsCreated >= 5 },
  { code: '10_workouts', label: '10 programmes créés', check: (c) => c.workoutsCreated >= 10 },
  // Level
  { code: 'elite', label: 'Niveau Élite atteint', check: (c) => c.level === 'elite' },
  // XP
  { code: 'xp_100', label: '100 XP accumulés', check: (c) => c.xp >= 100 },
  { code: 'xp_500', label: '500 XP accumulés', check: (c) => c.xp >= 500 },
  { code: 'xp_1000', label: '1 000 XP accumulés', check: (c) => c.xp >= 1000 },
  { code: 'xp_5000', label: '5 000 XP accumulés', check: (c) => c.xp >= 5000 },
  // Challenges
  { code: 'first_challenge', label: 'Premier défi relevé', check: (c) => c.challengesCompleted >= 1 },
  { code: '5_challenges', label: '5 défis relevés', check: (c) => c.challengesCompleted >= 5 },
  { code: '10_challenges', label: '10 défis relevés', check: (c) => c.challengesCompleted >= 10 },
  { code: '25_challenges', label: '25 défis relevés', check: (c) => c.challengesCompleted >= 25 },
  { code: 'challenge_creator', label: 'Créateur de défi', check: (c) => c.challengesCreated >= 1 },
  { code: 'challenge_creator_5', label: '5 défis créés', check: (c) => c.challengesCreated >= 5 },
  // Groups
  { code: 'group_member', label: 'Membre d\'un groupe', check: (c) => c.groupCount >= 1 },
  { code: 'group_leader', label: 'Créateur de groupe', check: (c) => c.groupsOwned >= 1 },
];

interface BadgeContext {
  completedSessions: number;
  loginStreak: number;
  friendCount: number;
  messagesSent: number;
  workoutsCreated: number;
  level: string;
  xp: number;
  challengesCompleted: number;
  challengesCreated: number;
  groupCount: number;
  groupsOwned: number;
}

// POST — check and award badges for the authenticated user
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const userId = payload.userId;

    // Gather context
    const [user, completedSessions, friendCount, messagesSent, workoutsCreated, loginDays, challengesCompleted, challengesCreated, groupCount, groupsOwned] = await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { level: true, xp: true } }),
      prisma.workoutSession.count({ where: { userId, status: { in: ['completed', 'done'] } } }),
      prisma.friendRequest.count({ where: { OR: [{ senderId: userId }, { receiverId: userId }], status: 'accepted' } }),
      prisma.message.count({ where: { senderId: userId } }),
      prisma.workout.count({ where: { userId } }),
      prisma.activityLog.findMany({
        where: { userId, action: 'login' },
        select: { createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.challengeCompletion.count({ where: { userId } }),
      prisma.challenge.count({ where: { creatorId: userId } }),
      prisma.groupMember.count({ where: { userId } }),
      prisma.group.count({ where: { ownerId: userId } }),
    ]);

    // Calculate login streak
    const uniqueDays = [...new Set(loginDays.map(l => l.createdAt.toISOString().slice(0, 10)))].sort().reverse();
    let loginStreak = 0;
    const today = new Date().toISOString().slice(0, 10);
    for (let i = 0; i < uniqueDays.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (uniqueDays[i] === expected) {
        loginStreak++;
      } else if (i === 0 && uniqueDays[0] !== today) {
        // Allow if the user hasn't logged in today yet but logged in yesterday
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (uniqueDays[0] === yesterday) {
          loginStreak++;
        } else {
          break;
        }
      } else {
        break;
      }
    }

    const ctx: BadgeContext = {
      completedSessions,
      loginStreak,
      friendCount,
      messagesSent,
      workoutsCreated,
      level: user?.level ?? 'intermediaire',
      xp: user?.xp ?? 0,
      challengesCompleted,
      challengesCreated,
      groupCount,
      groupsOwned,
    };

    // Check existing badges
    const existingBadges = await prisma.badge.findMany({ where: { userId }, select: { code: true } });
    const existingCodes = new Set(existingBadges.map(b => b.code));

    // Award new badges
    const newBadges: { code: string; label: string }[] = [];
    for (const def of BADGE_DEFS) {
      if (!existingCodes.has(def.code) && def.check(ctx)) {
        await prisma.badge.create({
          data: { userId, code: def.code, label: def.label },
        });
        newBadges.push({ code: def.code, label: def.label });
      }
    }

    // Return all badges
    const allBadges = await prisma.badge.findMany({
      where: { userId },
      orderBy: { earnedAt: 'asc' },
    });

    return NextResponse.json({ badges: allBadges, newBadges });
  } catch (error) {
    console.error('Badge check error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

// GET — list badges for the authenticated user
export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const badges = await prisma.badge.findMany({
      where: { userId: payload.userId },
      orderBy: { earnedAt: 'asc' },
    });

    return NextResponse.json({ badges });
  } catch (error) {
    console.error('Badge list error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
