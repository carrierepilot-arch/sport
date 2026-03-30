import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { getProfileImageUrl, withProfileImageUrl } from '@/lib/social';
import type { Prisma } from '@/lib/generated/prisma/client';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });

    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('avatar') as File | null;
    if (!file) return NextResponse.json({ error: 'Image requise' }, { status: 400 });
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format non supporte (jpg, png, webp)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Image trop volumineuse (max 5 MB)' }, { status: 400 });
    }

    const existingUser = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, name: true, pseudo: true, isAdmin: true, level: true, equipmentData: true },
    });
    if (!existingUser) return NextResponse.json({ error: 'Utilisateur introuvable' }, { status: 404 });

    const originalName = sanitizeName(file.name || 'avatar.jpg');
    const storagePath = `avatars/${payload.userId}/${Date.now()}-${originalName}`;
    const { url } = await put(storagePath, file, { access: 'public', contentType: file.type });

    const updated = await prisma.user.update({
      where: { id: payload.userId },
      data: {
        equipmentData: withProfileImageUrl(existingUser.equipmentData, url) as Prisma.InputJsonValue,
      },
      select: { id: true, email: true, name: true, pseudo: true, isAdmin: true, level: true, equipmentData: true },
    });

    return NextResponse.json({
      success: true,
      profileImageUrl: url,
      user: {
        ...updated,
        profileImageUrl: getProfileImageUrl(updated.equipmentData),
      },
    });
  } catch (error) {
    console.error('Avatar upload error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
