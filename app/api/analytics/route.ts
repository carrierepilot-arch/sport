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
 const completed = sessions.filter(s => s.status === 'done');
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
 if (s.results && Array.isArray(s.results)) {
 // results is ExerciceResult[] = [{ nom, series, targetReps, repos, sets: [{ success, repsActuelles? }] }]
 const exercices = s.results as { nom: string; series: number; targetReps: string; repos: string; sets: { success: boolean; repsActuelles?: number }[] }[];
 for (const exo of exercices) {
 if (Array.isArray(exo.sets)) {
 totalSeries += exo.sets.length;
 for (const set of exo.sets) {
 if (set.repsActuelles != null) {
 totalReps += set.repsActuelles;
 } else {
 // If repsActuelles not tracked (success=true), use targetReps
 const target = parseInt(String(exo.targetReps));
 if (!isNaN(target) && set.success) totalReps += target;
 }
 }
 }
 }
 }
 }

 // Exercise breakdown (top exercises)
 const exerciseMap: Record<string, { count: number; totalReps: number }> = {};
 for (const s of completed) {
 if (s.results && Array.isArray(s.results)) {
 const exercices = s.results as { nom: string; series: number; targetReps: string; repos: string; sets: { success: boolean; repsActuelles?: number }[] }[];
 for (const exo of exercices) {
 if (!exerciseMap[exo.nom]) exerciseMap[exo.nom] = { count: 0, totalReps: 0 };
 exerciseMap[exo.nom].count++;
 if (Array.isArray(exo.sets)) {
 for (const set of exo.sets) {
 exerciseMap[exo.nom].totalReps += set.repsActuelles ?? (set.success ? parseInt(String(exo.targetReps)) || 0 : 0);
 }
 }
 }
 }
 }
 const topExercises = Object.entries(exerciseMap)
 .map(([name, data]) => ({ name, ...data }))
 .sort((a, b) => b.count - a.count)
 .slice(0, 8);

 // Weekly volume per key exercise (last 8 weeks)
 const keyExercises = ['tractions', 'pompes', 'dips', 'squats'];
 const weeklyVolume: { label: string; tractions: number; pompes: number; dips: number; squats: number }[] = [];
 for (let i = 7; i >= 0; i--) {
 const weekStart = new Date(now.getTime() - (i * 7 + 6) * 86400000);
 const weekEnd = new Date(now.getTime() - i * 7 * 86400000 + 86400000);
 const weekSessions = completed.filter(s => {
 const d = new Date(s.finishedAt ?? s.createdAt);
 return d >= weekStart && d < weekEnd;
 });
 const vol: Record<string, number> = { tractions: 0, pompes: 0, dips: 0, squats: 0 };
 for (const s of weekSessions) {
 if (s.results && Array.isArray(s.results)) {
 const exercices = s.results as { nom: string; series: number; targetReps: string; repos: string; sets: { success: boolean; repsActuelles?: number }[] }[];
 for (const exo of exercices) {
 const nomLower = exo.nom.toLowerCase();
 for (const key of keyExercises) {
 if (nomLower.includes(key)) {
 if (Array.isArray(exo.sets)) {
 for (const set of exo.sets) {
 vol[key] += set.repsActuelles ?? (set.success ? parseInt(String(exo.targetReps)) || 0 : 0);
 }
 }
 }
 }
 }
 }
 }
 weeklyVolume.push({ label: `S${8 - i}`, tractions: vol.tractions, pompes: vol.pompes, dips: vol.dips, squats: vol.squats });
 }

 // Level test history
 const levelTests = await prisma.activityLog.findMany({
 where: { userId, action: 'level_test' },
 select: { details: true, createdAt: true },
 orderBy: { createdAt: 'desc' },
 take: 20,
 });
 const levelTestHistory = levelTests.map(lt => {
 try {
 const d = JSON.parse(lt.details || '{}');
 return { ...d, date: lt.createdAt.toISOString().slice(0, 10) };
 } catch { return { date: lt.createdAt.toISOString().slice(0, 10) }; }
 });

 // Monthly data (last 6 months)
 const monthlyData: { label: string; sessions: number; minutes: number }[] = [];
 for (let i = 5; i >= 0; i--) {
 const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
 const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999);
 const monthSessions = completed.filter(s => {
 const sd = new Date(s.finishedAt ?? s.createdAt);
 return sd >= d && sd <= monthEnd;
 });
 let monthMinutes = 0;
 for (const ms of monthSessions) {
 if (ms.startedAt && ms.finishedAt) monthMinutes += Math.round((new Date(ms.finishedAt).getTime() - new Date(ms.startedAt).getTime()) / 60000);
 }
 const monthNames = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc'];
 monthlyData.push({ label: monthNames[d.getMonth()], sessions: monthSessions.length, minutes: monthMinutes });
 }

 // Average session duration
 const avgMinutes = totalCompleted > 0 ? Math.round(totalMinutes / totalCompleted) : 0;

 // Challenges completed count
 const challengesCompleted = await prisma.challengeCompletion.count({ where: { userId } });

 // XP
 const userXp = await prisma.user.findUnique({ where: { id: userId }, select: { xp: true } });

 return NextResponse.json({
 totalWorkouts,
 totalCompleted,
 totalMinutes,
 totalSeries,
 totalReps,
 streak,
 thisWeekSessions,
 weeklyData,
 topExercises,
 monthlyData,
 avgMinutes,
 challengesCompleted,
 xp: userXp?.xp ?? 0,
 weeklyVolume,
 levelTestHistory,
 });
 } catch (error) {
 console.error('Analytics error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
