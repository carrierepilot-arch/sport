import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

// GET — spots en attente + tous les spots
export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'spots:read');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 const spots = await prisma.spot.findMany({
 include: {
 addedByUser: { select: { pseudo: true, name: true } },
 _count: { select: { performances: true } },
 },
 orderBy: { createdAt: 'desc' },
 });

 return NextResponse.json({ spots });
}

// POST — approve / reject / delete spot
export async function POST(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'spots:write');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 const { spotId, action } = await request.json();
 if (!spotId || !['approve', 'reject', 'delete'].includes(action)) {
 return NextResponse.json({ error: 'Paramètres invalides' }, { status: 400 });
 }

 if (action === 'delete') {
 await prisma.performance.deleteMany({ where: { spotId } });
 await prisma.spot.delete({ where: { id: spotId } });
 await logAdminAction(admin.userId, 'admin.spot.delete', `spotId=${spotId}`);
 return NextResponse.json({ success: true });
 }

 const spot = await prisma.spot.update({
 where: { id: spotId },
 data: { status: action === 'approve' ? 'approved' : 'rejected' },
 });

 await logAdminAction(admin.userId, 'admin.spot.status_update', `spotId=${spotId} action=${action}`);

 return NextResponse.json({ success: true, spot });
}
