import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'application/zip'];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
 // The authorization header is sent by the browser on the token-generation step.
 // Vercel calls this same endpoint again for the onUploadCompleted callback
 // (without the user's auth header), so auth is only enforced on the first call.
 const authHeader = request.headers.get('authorization') ?? '';
 const token = authHeader.replace('Bearer ', '');

 try {
 const body = (await request.json()) as HandleUploadBody;

 const jsonResponse = await handleUpload({
 body,
 request,
 onBeforeGenerateToken: async (_pathname, clientPayload) => {
 if (!token) throw new Error('Non authentifie');
 const payload = verifyToken(token);
 if (!payload) throw new Error('Token invalide');

 const performanceId = clientPayload ?? '';
 const performance = await prisma.performance.findUnique({ where: { id: performanceId } });
 if (!performance) throw new Error('Performance introuvable');
 if (performance.userId !== payload.userId) throw new Error('Non autorise');

 return {
 allowedContentTypes: ALLOWED_TYPES,
 maximumSizeInBytes: MAX_SIZE,
 // Carry userId + performanceId into the completion callback
 tokenPayload: JSON.stringify({ userId: payload.userId, performanceId }),
 };
 },

 onUploadCompleted: async ({ blob, tokenPayload }) => {
 if (!tokenPayload) return;
 const { performanceId } = JSON.parse(tokenPayload) as { userId: string; performanceId: string };
 await prisma.performance.update({
 where: { id: performanceId },
 data: { videoUrl: blob.url, videoStoragePath: blob.pathname },
 });
 },
 });

 return NextResponse.json(jsonResponse);
 } catch (error) {
 const msg = error instanceof Error ? error.message : String(error);
 return NextResponse.json({ error: msg }, { status: 400 });
 }
}
