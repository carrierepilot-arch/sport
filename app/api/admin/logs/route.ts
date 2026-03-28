import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
 try {
 const admin = await requireAdminPermission(request, 'logs:read');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 const { searchParams } = new URL(request.url);
 const page = parseInt(searchParams.get('page') ?? '1');
 const adminOnly = (searchParams.get('adminOnly') ?? 'false') === 'true';
 const limit = 50;

 const [logs, total] = await Promise.all([
 prisma.activityLog.findMany({
 where: adminOnly ? { action: { startsWith: 'admin.' } } : undefined,
 include: { user: { select: { email: true, name: true, pseudo: true } } },
 orderBy: { createdAt: 'desc' },
 skip: (page - 1) * limit,
 take: limit,
 }),
 prisma.activityLog.count({ where: adminOnly ? { action: { startsWith: 'admin.' } } : undefined }),
 ]);

 return NextResponse.json({ logs, total, page, pages: Math.ceil(total / limit) });
 } catch (error) {
 console.error('Admin logs error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
