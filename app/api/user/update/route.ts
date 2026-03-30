import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl, getProfileVisibility, withProfileVisibility } from '@/lib/social';
import type { Prisma } from '@/lib/generated/prisma/client';

export async function PATCH(request: NextRequest) {
 try {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });

 const payload = verifyToken(token);
 if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

 const body = await request.json();
 const { pseudo, name, level, levelTestData, profileVisibility } = body;

 // Valider que le pseudo n'est pas déjà pris par un autre utilisateur
 if (pseudo?.trim()) {
 const existing = await prisma.user.findFirst({
 where: {
 pseudo: { equals: pseudo.trim(), mode: 'insensitive' },
 id: { not: payload.userId },
 },
 });
 if (existing) {
 return NextResponse.json({ error: 'Ce pseudo est déjà utilisé' }, { status: 409 });
 }
 }

 const data: Record<string, unknown> = {};
 if (pseudo !== undefined) data.pseudo = pseudo?.trim() || null;
 if (name !== undefined) data.name = name?.trim() || null;
 if (level && ['debutant', 'intermediaire', 'elite'].includes(level)) data.level = level;
 if (levelTestData !== undefined) data.levelTestData = levelTestData;

 if (profileVisibility !== undefined && profileVisibility !== 'public' && profileVisibility !== 'private') {
 return NextResponse.json({ error: 'Visibilite de profil invalide' }, { status: 400 });
 }

 const currentUser = await prisma.user.findUnique({
 where: { id: payload.userId },
 select: { equipmentData: true },
 });
 if (!currentUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

 if (profileVisibility === 'public' || profileVisibility === 'private') {
 data.equipmentData = withProfileVisibility(currentUser.equipmentData, profileVisibility) as Prisma.InputJsonValue;
 }

 let updated;
 try {
 updated = await prisma.user.update({
 where: { id: payload.userId },
 data,
 select: { id: true, email: true, name: true, pseudo: true, isAdmin: true, level: true, equipmentData: true },
 });
 } catch {
 const fallbackData = { ...data };
 delete fallbackData.levelTestData;
 updated = await prisma.user.update({
 where: { id: payload.userId },
 data: fallbackData,
 select: { id: true, email: true, name: true, pseudo: true, isAdmin: true, level: true, equipmentData: true },
 });
 }

 return NextResponse.json({
 success: true,
 user: {
 ...updated,
 profileImageUrl: getProfileImageUrl(updated.equipmentData),
 profileVisibility: getProfileVisibility(updated.equipmentData),
 },
 });
 } catch (error) {
 console.error('Update user error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
