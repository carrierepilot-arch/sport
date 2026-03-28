import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { put } from '@vercel/blob';
import { logApiCall } from '@/lib/api-logger';

const MAX_SIZE = 80 * 1024 * 1024; // 80 MB
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

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
 const file = formData.get('video') as File | null;
 const performanceId = formData.get('performanceId') as string | null;

 if (!file || !performanceId) {
 return NextResponse.json({ error: 'Video et performanceId requis' }, { status: 400 });
 }
 if (!ALLOWED_TYPES.includes(file.type)) {
 return NextResponse.json({ error: 'Format video non supporte (mp4, webm, mov)' }, { status: 400 });
 }
 if (file.size > MAX_SIZE) {
 return NextResponse.json({ error: 'Video trop volumineuse (max 80 MB)' }, { status: 400 });
 }

 const performance = await prisma.performance.findUnique({ where: { id: performanceId } });
 if (!performance) return NextResponse.json({ error: 'Performance introuvable' }, { status: 404 });
 if (performance.userId !== payload.userId) {
 return NextResponse.json({ error: 'Non autorise' }, { status: 403 });
 }

 const originalName = sanitizeName(file.name || 'video.mp4');
 const storagePath = `performances/${payload.userId}/${performanceId}/${Date.now()}-${originalName}`;

 const { url } = await put(storagePath, file, {
 access: 'public',
 contentType: file.type,
 });

 await logApiCall({
 apiName: 'vercel-blob',
 endpoint: storagePath,
 requestPayload: { performanceId, originalSize: file.size },
 responseStatus: 200,
 userId: payload.userId,
 });

 await prisma.performance.update({
 where: { id: performanceId },
 data: { videoUrl: url, videoStoragePath: storagePath },
 });

 return NextResponse.json({ videoUrl: url, videoStoragePath: storagePath });
 } catch (error) {
 const msg = error instanceof Error ? error.message : String(error);
 return NextResponse.json({ error: `Erreur upload: ${msg}` }, { status: 500 });
 }
}
