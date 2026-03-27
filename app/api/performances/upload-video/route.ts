import { NextRequest, NextResponse } from 'next/server';
import { put } from '@vercel/blob';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const MAX_SIZE = 50 * 1024 * 1024; // 50 MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

// POST — upload video for a performance
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('video') as File | null;
    const performanceId = formData.get('performanceId') as string | null;

    if (!file || !performanceId) {
      return NextResponse.json({ error: 'Vidéo et performanceId requis' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format vidéo non supporté (mp4, webm, mov)' }, { status: 400 });
    }
    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'Vidéo trop volumineuse (max 50 MB)' }, { status: 400 });
    }

    // Verify the performance belongs to the user
    const performance = await prisma.performance.findUnique({ where: { id: performanceId } });
    if (!performance) return NextResponse.json({ error: 'Performance introuvable' }, { status: 404 });
    if (performance.userId !== payload.userId) {
      return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });
    }

    // Upload to Vercel Blob
    const ext = file.name.split('.').pop() || 'mp4';
    const filename = `perf-${performanceId}-${Date.now()}.${ext}`;
    
    const blobToken = process.env.BLOB_READ_WRITE_TOKEN;
    if (!blobToken) {
      console.error('BLOB_READ_WRITE_TOKEN not set');
      return NextResponse.json({ error: 'Configuration stockage manquante' }, { status: 500 });
    }

    const blob = await put(filename, file, {
      access: 'public',
      addRandomSuffix: true,
      token: blobToken,
    });

    // Update performance with video URL
    await prisma.performance.update({
      where: { id: performanceId },
      data: { videoUrl: blob.url },
    });

    return NextResponse.json({ videoUrl: blob.url });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    console.error('Video upload error:', msg);
    return NextResponse.json({ error: `Erreur upload: ${msg}` }, { status: 500 });
  }
}
