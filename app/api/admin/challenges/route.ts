import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

// GET — défis en attente de validation + tous les défis créés par les utilisateurs
export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'challenges:read');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 const [pending, all] = await Promise.all([
 prisma.challenge.findMany({
 where: { submittedForReview: true, adminApproved: false },
 include: {
 creator: { select: { id: true, pseudo: true, name: true, email: true } },
 _count: { select: { completions: true } },
 },
 orderBy: { createdAt: 'desc' },
 }),
 prisma.challenge.findMany({
 where: { creatorId: { not: null } },
 include: {
 creator: { select: { id: true, pseudo: true, name: true, email: true } },
 _count: { select: { completions: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 100,
 }),
 ]);

 return NextResponse.json({ pending, all });
}

// PATCH — approve | reject | delete | toggle_public
export async function PATCH(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'challenges:write');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 const { challengeId, action } = await request.json() as {
 challengeId: string;
 action: 'approve' | 'reject' | 'delete' | 'toggle_public';
 };

 if (!challengeId || !['approve', 'reject', 'delete', 'toggle_public'].includes(action)) {
 return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
 }

 if (action === 'delete') {
 await prisma.challengeCompletion.deleteMany({ where: { challengeId } });
 await prisma.challenge.delete({ where: { id: challengeId } });
 await logAdminAction(admin.userId, 'admin.challenge.delete', `challengeId=${challengeId}`);
 return NextResponse.json({ ok: true });
 }

 if (action === 'approve') {
 const updated = await prisma.challenge.update({
 where: { id: challengeId },
 data: { adminApproved: true, isPublic: true },
 });
 await logAdminAction(admin.userId, 'admin.challenge.approve', `challengeId=${challengeId}`);
 return NextResponse.json({ challenge: updated });
 }

 if (action === 'reject') {
 const updated = await prisma.challenge.update({
 where: { id: challengeId },
 data: { adminApproved: false, submittedForReview: false, isPublic: false },
 });
 await logAdminAction(admin.userId, 'admin.challenge.reject', `challengeId=${challengeId}`);
 return NextResponse.json({ challenge: updated });
 }

 if (action === 'toggle_public') {
 const current = await prisma.challenge.findUnique({
 where: { id: challengeId },
 select: { isPublic: true },
 });
 if (!current) return NextResponse.json({ error: 'Défi introuvable' }, { status: 404 });
 const updated = await prisma.challenge.update({
 where: { id: challengeId },
 data: { isPublic: !current.isPublic },
 });
 await logAdminAction(admin.userId, 'admin.challenge.toggle_public', `challengeId=${challengeId} newPublic=${String(updated.isPublic)}`);
 return NextResponse.json({ challenge: updated });
 }

 return NextResponse.json({ error: 'Action inconnue' }, { status: 400 });
}
