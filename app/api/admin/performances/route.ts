import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { list, del as blobDel } from '@vercel/blob';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';
import { checkRateLimit } from '@/lib/simple-rate-limit';

const DEFAULT_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

function parseQuotaBytes(): number {
 const raw = process.env.BLOB_STORAGE_QUOTA_BYTES;
 const parsed = Number(raw);
 return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STORAGE_QUOTA_BYTES;
}

async function deleteStoredVideo(
 adminUserId: string,
 performanceId: string,
 videoUrl: string | null | undefined,
) {
 if (!videoUrl) return;
 try {
 await validateBlobVideoUrl(videoUrl);
 } catch {
 await logAdminAction(
 adminUserId,
 'admin.performance.video_delete_rejected',
 `performanceId=${performanceId} reason=invalid_blob_url`,
 );
 return;
 }

 try {
 await blobDel(videoUrl);
 } catch {
 // Non-blocking: DB cleanup should still happen even if file is already removed.
 }
}

async function validateBlobVideoUrl(videoUrl: string): Promise<void> {
 try {
 const parsed = new URL(videoUrl);
 const validProtocol = parsed.protocol === 'https:';
 const validHost = parsed.hostname.endsWith('.blob.vercel-storage.com') || parsed.hostname === 'blob.vercel-storage.com';
 const validPath = parsed.pathname.startsWith('/performances/');
 if (!validProtocol || !validHost || !validPath) {
 throw new Error('URL blob non autorisee');
 }
 } catch {
 throw new Error('URL blob invalide');
 }
}

async function getVideoStorageStats() {
 let usedBytes = 0;
 let fileCount = 0;
 let cursor: string | undefined;

 do {
  const page = await list({ prefix: 'performances/', limit: 1000, cursor });
  for (const b of page.blobs) {
   usedBytes += b.size;
   fileCount += 1;
  }
  cursor = page.hasMore ? page.cursor : undefined;
 } while (cursor);

 const quotaBytes = parseQuotaBytes();
 return {
  usedBytes,
  quotaBytes,
  remainingBytes: Math.max(0, quotaBytes - usedBytes),
  fileCount,
 };
}

// GET — list all performances (admin)
export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'performances:read');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
 const rate = checkRateLimit(`admin-performances:${admin.userId}:${ip}`, 30, 60_000);
 if (!rate.ok) {
 await logAdminAction(
 admin.userId,
 'admin.performance.rate_limited',
 `ip=${ip} retryAfter=${rate.retryAfterSec}s`,
 );
 return NextResponse.json(
 { error: 'Trop de requêtes. Réessayez dans quelques secondes.' },
 { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
 );
 }

 try {
 try {
 const performances = await prisma.performance.findMany({
 include: {
 user: { select: { id: true, pseudo: true, name: true, email: true } },
 spot: { select: { id: true, name: true, city: true } },
 validations: { select: { validatorId: true, status: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 200,
 });

        const storage = await getVideoStorageStats();

 return NextResponse.json({ performances, storage });
 } catch {
 const legacyPerformances = await prisma.performance.findMany({
 select: {
 id: true,
 userId: true,
 spotId: true,
 exercise: true,
 score: true,
 unit: true,
 status: true,
 videoUrl: true,
 createdAt: true,
 user: { select: { id: true, pseudo: true, name: true, email: true } },
 spot: { select: { id: true, name: true, city: true } },
 validations: { select: { validatorId: true, status: true } },
 },
 orderBy: { createdAt: 'desc' },
 take: 200,
 });

 return NextResponse.json({
 performances: legacyPerformances,
 storage: { usedBytes: 0, quotaBytes: parseQuotaBytes(), remainingBytes: parseQuotaBytes(), fileCount: 0 },
 });
 }
 } catch (error) {
 console.error('Admin performances GET:', error);
 return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
 }
}

// PUT — update a performance (admin)
export async function PUT(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'performances:write');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 try {
 const { performanceId, score, status } = await request.json();
 if (!performanceId) return NextResponse.json({ error: 'performanceId requis' }, { status: 400 });

 const data: Record<string, unknown> = {};
 if (score !== undefined) data.score = Number(score);
 if (status !== undefined) data.status = String(status);

 const updated = await prisma.performance.update({
 where: { id: performanceId },
 data,
 include: {
 user: { select: { id: true, pseudo: true, name: true, email: true } },
 spot: { select: { id: true, name: true, city: true } },
 validations: { select: { validatorId: true, status: true } },
 },
 });
 await logAdminAction(admin.userId, 'admin.performance.update', `performanceId=${performanceId} score=${String(score)} status=${String(status)}`);
 return NextResponse.json({ performance: updated });
 } catch (error) {
 console.error('Admin performances PUT:', error);
 return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
 }
}

// DELETE — delete a performance (admin)
export async function DELETE(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'performances:write');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

 try {
 const { performanceId, videoOnly } = await request.json();
 if (!performanceId) return NextResponse.json({ error: 'performanceId requis' }, { status: 400 });

 let performance: { id: string; videoUrl: string | null; videoStoragePath?: string | null } | null = null;
 try {
 performance = await prisma.performance.findUnique({
 where: { id: performanceId },
 select: { id: true, videoUrl: true, videoStoragePath: true },
 });
 } catch {
 performance = await prisma.performance.findUnique({
 where: { id: performanceId },
 select: { id: true, videoUrl: true },
 });
 }
 if (!performance) return NextResponse.json({ error: 'Performance introuvable' }, { status: 404 });

 if (videoOnly) {
 if (performance.videoUrl) await deleteStoredVideo(admin.userId, performanceId, performance.videoUrl);
 const updated = await prisma.performance.update({
 where: { id: performanceId },
 data: performance.videoStoragePath !== undefined ? { videoUrl: null, videoStoragePath: null } : { videoUrl: null },
 });
 await logAdminAction(admin.userId, 'admin.performance.video_delete', `performanceId=${performanceId}`);
 return NextResponse.json({ success: true, performance: updated });
 }

 if (performance.videoUrl) await deleteStoredVideo(admin.userId, performanceId, performance.videoUrl);
 await prisma.performance.delete({ where: { id: performanceId } });
 await logAdminAction(admin.userId, 'admin.performance.delete', `performanceId=${performanceId}`);
 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Admin performances DELETE:', error);
 return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
 }
}
