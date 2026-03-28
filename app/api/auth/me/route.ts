import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function GET(request: NextRequest) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 let user: {
 id: string;
 email: string;
 name: string | null;
 pseudo: string | null;
 isAdmin: boolean;
 level?: string;
 xp?: number;
 equipmentData?: unknown;
 levelTestData?: unknown;
 } | null = null;

 try {
 user = await prisma.user.findUnique({
 where: { id: payload.userId },
 select: {
 id: true,
 email: true,
 name: true,
 pseudo: true,
 isAdmin: true,
 level: true,
 xp: true,
 equipmentData: true,
 levelTestData: true,
 },
 });
 } catch {
 // Fallback for environments where newer columns are not yet migrated.
 user = await prisma.user.findUnique({
 where: { id: payload.userId },
 select: { id: true, email: true, name: true, pseudo: true, isAdmin: true },
 });
 }

 if (!user) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

 return NextResponse.json({
 user: {
 ...user,
 level: user.level ?? 'intermediaire',
 xp: user.xp ?? 0,
 equipmentData: user.equipmentData ?? null,
 levelTestData: user.levelTestData ?? null,
 },
 });
 } catch (error) {
 console.error('Me error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
