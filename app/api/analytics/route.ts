import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const userId = payload.userId;

    // Fetch all workout sessions for this user
    const sessions = await prisma.workoutSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        dayLabel: true,
        status: true,
        results: true,
        startedAt: true,
        finishedAt: true,
        createdAt: true,
      },
    });

    const totalWorkouts = await prisma.workout.count({ where: { userId } });

    // Completed sessions
    const completed = sessions.filter(s => s.status === 'completed');
    const totalCompleted = completed.length;

    // Total training time (minutes)
    let totalMinutes = 0;
    for (const s of completed) {
      if (s.startedAt && s.finishedAt) {
        const diff = new Date(s.finishedAt).getTime() - new Date(s.startedAt).getTime();
        totalMinutes += Math.round(diff / 60000);
      }
    }

    // Sessions per week (last 8 weeks)
    const now = new Date();
    const weeklyData: { label: string; count: number }[] = [];
    for (let i = 7; i >= 0; i--) {
      const weekStart = new Date(now.getTime() - (i * 7 + 6) * 86400000);
      const weekEnd = new Date(now.getTime() - i * 7 * 86400000 + 86400000);
      const count = completed.filter(s => {
        const d = new Date(s.finishedAt ?? s.createdAt);
        return d >= weekStart && d < weekEnd;
      }).length;
      weeklyData.push({ label: `S${8 - i}`, count });
    }

    // Login streak (from activity logs)
    const loginDays = await prisma.activityLog.findMany({
      where: { userId, action: 'login' },
      select: { createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const uniqueDays = [...new Set(loginDays.map(l => l.createdAt.toISOString().slice(0, 10)))].sort().reverse();
    let streak = 0;
    for (let i = 0; i < uniqueDays.length; i++) {
      const expected = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
      if (uniqueDays[i] === expected) {
        streak++;
      } else if (i === 0) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
        if (uniqueDays[0] === yesterday) { streak++; } else { break; }
      } else { break; }
    }

    // This week progress
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay() + 1); // Monday
    weekStart.setHours(0, 0, 0, 0);
    const thisWeekSessions = completed.filter(s => new Date(s.finishedAt ?? s.createdAt) >= weekStart).length;

    // Total series and reps from results
    let totalSeries = 0;
    let totalReps = 0;
    for (const s of completed) {
      if (s.results && typeof s.results === 'object') {
        const res = s.results as Record<string, { series?: number; reps?: string | number }[]>;
        for (const exercices of Object.values(res)) {
          if (Array.isArray(exercices)) {
            for (const set of exercices) {
              totalSeries++;
              const r = typeof set.reps === 'string' ? parseInt(set.reps) : (set.reps ?? 0);
              if (!isNaN(r)) totalReps += r;
            }
          }
        }
      }
    }

    return NextResponse.json({
      totalWorkouts,
      totalCompleted,
      totalMinutes,
      totalSeries,
      totalReps,
      streak,
      thisWeekSessions,
      weeklyData,
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
