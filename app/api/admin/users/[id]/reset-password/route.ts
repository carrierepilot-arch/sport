import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import bcrypt from 'bcryptjs';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

// POST — admin resets a user's password to a random temporary one
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
 try {
 const admin = await requireAdminPermission(request, 'users:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 const { id } = await params;

 if (id === admin.userId) {
 return NextResponse.json({ error: 'Utilisez la page profil pour changer votre propre mot de passe' }, { status: 400 });
 }

 const target = await prisma.user.findUnique({ where: { id }, select: { id: true, email: true } });
 if (!target) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

 // Generate a random 12-char temporary password
 const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
 const randomBytes = new Uint32Array(12);
 crypto.getRandomValues(randomBytes);
 let tempPassword = '';
 for (let i = 0; i < 12; i++) {
 tempPassword += chars[randomBytes[i] % chars.length];
 }

 const hashed = await bcrypt.hash(tempPassword, 10);
 await prisma.user.update({ where: { id }, data: { password: hashed } });
 await logAdminAction(admin.userId, 'admin.user.reset_password', `Reset password for ${target.email}`);

 return NextResponse.json({
 success: true,
 tempPassword,
 message: `Mot de passe réinitialisé pour ${target.email}. Communiquez-lui le mot de passe temporaire de manière sécurisée.`,
 });
 } catch (error) {
 console.error('Admin reset password error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
