import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

export async function GET(request: NextRequest) {
 try {
 const admin = await requireAdminPermission(request, 'suggestions:read');
 if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

 try {
 const suggestions = await prisma.suggestion.findMany({
 include: {
 user: { select: { id: true, email: true, name: true, pseudo: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 300,
 });
 return NextResponse.json({ suggestions });
 } catch {
 return NextResponse.json({ suggestions: [], unavailable: true });
 }
 } catch (error) {
 console.error('Admin suggestions GET error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

export async function PATCH(request: NextRequest) {
 try {
 const admin = await requireAdminPermission(request, 'suggestions:write');
 if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

 const body = await request.json().catch(() => ({}));
 const suggestionId = typeof body.suggestionId === 'string' ? body.suggestionId : '';
 const status = typeof body.status === 'string' ? body.status : '';
 if (!suggestionId || !['new', 'reviewed', 'done'].includes(status)) {
 return NextResponse.json({ error: 'suggestionId et status valides requis' }, { status: 400 });
 }

 const suggestion = await prisma.suggestion.update({
 where: { id: suggestionId },
 data: { status },
 include: {
 user: { select: { id: true, email: true, name: true, pseudo: true } },
 },
 });

 await logAdminAction(admin.userId, 'admin.suggestion.status_update', `suggestionId=${suggestionId} status=${status}`);

 return NextResponse.json({ suggestion });
 } catch (error) {
 console.error('Admin suggestions PATCH error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}