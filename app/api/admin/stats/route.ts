import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
 try {
 const admin = await requireAdminPermission(request, 'stats:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

 const [
 totalUsers,
 totalMessages,
 totalFriendships,
 pendingFriendRequests,
 usersWithPseudo,
 newUsersThisWeek,
 recentSessions,
 recentRegistrations,
 recentMessages,
 allUsers,
 ] = await Promise.all([
 prisma.user.count(),
 prisma.message.count(),
 prisma.friendRequest.count({ where: { status: 'accepted' } }),
 prisma.friendRequest.count({ where: { status: 'pending' } }),
 prisma.user.count({ where: { pseudo: { not: null } } }),
 prisma.user.count({ where: { createdAt: { gte: sevenDaysAgo } } }),
 prisma.userSession.findMany({
 orderBy: { lastSeen: 'desc' },
 take: 20,
 include: { user: { select: { email: true, name: true, pseudo: true } } },
 }),
 prisma.user.findMany({
 where: { createdAt: { gte: sevenDaysAgo } },
 select: { createdAt: true },
 orderBy: { createdAt: 'asc' },
 }),
 prisma.message.findMany({
 where: { createdAt: { gte: sevenDaysAgo } },
 select: { createdAt: true },
 orderBy: { createdAt: 'asc' },
 }),
 prisma.user.findMany({
 select: {
 email: true,
 name: true,
 pseudo: true,
 _count: { select: { sentMessages: true, sentFriendRequests: true } },
 },
 }),
 ]);

 let apiLogs: Array<{ apiName: string; createdAt: Date; tokensUsed: number | null; costEstimate: number | null }> = [];
 let apiLogsTotal: Array<{ apiName: string }> = [];
 try {
 [apiLogs, apiLogsTotal] = await Promise.all([
 prisma.apiLog.findMany({
 where: { createdAt: { gte: sevenDaysAgo } },
 select: {
 apiName: true,
 createdAt: true,
 tokensUsed: true,
 costEstimate: true,
 },
 orderBy: { createdAt: 'asc' },
 }),
 prisma.apiLog.findMany({
 select: {
 apiName: true,
 },
 }),
 ]);
 } catch {
 // Keep admin stats endpoint available even if api_logs table isn't ready yet.
 }

 // Tendances des 7 derniers jours (inscriptions + messages)
 const days: { label: string; date: string }[] = [];
 for (let i = 6; i >= 0; i--) {
 const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000);
 days.push({
 date: d.toISOString().slice(0, 10),
 label: d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' }),
 });
 }

 const registrationsByDay = days.map(({ label, date }) => ({
 label,
 count: recentRegistrations.filter((u) => u.createdAt.toISOString().slice(0, 10) === date).length,
 }));

 const messagesByDay = days.map(({ label, date }) => ({
 label,
 count: recentMessages.filter((m) => m.createdAt.toISOString().slice(0, 10) === date).length,
 }));

 const apis = ['exerciseDB', 'wger', 'openai', 'ncbi'] as const;
 const apiByDay = days.map(({ label, date }) => {
 const row: Record<string, number | string> = { label };
 for (const api of apis) {
 row[api] = apiLogs.filter((l) => l.apiName === api && l.createdAt.toISOString().slice(0, 10) === date).length;
 }
 return row;
 });

 const apiTotals = apis.reduce((acc, api) => {
 acc[api] = apiLogsTotal.filter((l) => l.apiName === api).length;
 return acc;
 }, {} as Record<string, number>);

 const openAiStats = apiLogs
 .filter((l) => l.apiName === 'openai')
 .reduce((acc, log) => {
 acc.tokens += log.tokensUsed ?? 0;
 acc.cost += log.costEstimate ?? 0;
 return acc;
 }, { tokens: 0, cost: 0 });

 // Top 5 utilisateurs par messages envoyés
 const topUsers = [...allUsers]
 .sort((a, b) => b._count.sentMessages - a._count.sentMessages)
 .slice(0, 5)
 .map((u) => ({
 display: u.pseudo ?? u.name ?? u.email,
 email: u.email,
 messages: u._count.sentMessages,
 friendRequests: u._count.sentFriendRequests,
 }));

 return NextResponse.json({
 stats: {
 totalUsers,
 totalMessages,
 totalFriendships,
 pendingFriendRequests,
 usersWithPseudo,
 newUsersThisWeek,
 },
 recentSessions,
 registrationsByDay,
 messagesByDay,
 topUsers,
 apiStats: {
 apiByDay,
 apiTotals,
 openAi: openAiStats,
 },
 });
 } catch (error) {
 console.error('Admin stats error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
