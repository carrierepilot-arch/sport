import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'reports:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 let reports: Array<{
 id: string;
 reportedUserId: string | null;
 targetType: string;
 targetId: string;
 createdAt: Date;
 reporter: { id: string; pseudo: string | null; name: string | null; email: string };
 reportedUser: { id: string; pseudo: string | null; name: string | null; email: string } | null;
 }> = [];

 try {
 reports = await prisma.report.findMany({
 include: {
 reporter: { select: { id: true, pseudo: true, name: true, email: true } },
 reportedUser: { select: { id: true, pseudo: true, name: true, email: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 500,
 });
 } catch {
 return NextResponse.json({ reports: [], reportTotals: [] });
 }

 const byUser = reports.reduce((acc, report) => {
 const key = report.reportedUserId || `${report.targetType}:${report.targetId}`;
 if (!acc[key]) {
 acc[key] = {
 key,
 reportedUserId: report.reportedUserId,
 reportedDisplay: report.reportedUser ? (report.reportedUser.pseudo || report.reportedUser.name || report.reportedUser.email) : `${report.targetType}:${report.targetId}`,
 total: 0,
 lastAt: report.createdAt.toISOString(),
 };
 }
 acc[key].total += 1;
 if (new Date(report.createdAt) > new Date(acc[key].lastAt)) {
 acc[key].lastAt = report.createdAt.toISOString();
 }
 return acc;
 }, {} as Record<string, { key: string; reportedUserId: string | null; reportedDisplay: string; total: number; lastAt: string }>);

 return NextResponse.json({
 reports,
 reportTotals: Object.values(byUser).sort((a, b) => b.total - a.total),
 });
}
