import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSupabaseAdmin, SUPABASE_STORAGE_BUCKET } from '@/lib/supabase-admin';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';

const DEFAULT_STORAGE_QUOTA_BYTES = 5 * 1024 * 1024 * 1024; // 5 GB

function parseQuotaBytes(): number {
 const raw = process.env.BLOB_STORAGE_QUOTA_BYTES;
 const parsed = Number(raw);
 return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_STORAGE_QUOTA_BYTES;
}

async function deleteStoredVideo(path: string | null | undefined) {
 if (!path) return;
 try {
 const supabase = getSupabaseAdmin();
 await supabase.storage.from(SUPABASE_STORAGE_BUCKET).remove([path]);
 } catch {
 // Non-blocking: DB cleanup should still happen even if file is already removed.
 }
}

async function getVideoStorageStats(paths: string[]) {
 let usedBytes = 0;
 const supabase = getSupabaseAdmin();

 await Promise.all(paths.map(async (path) => {
 const [folder, ...rest] = path.split('/');
 const fileName = rest.join('/');
 if (!folder || !fileName) return;

 try {
 const { data } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).list(folder, {
 search: fileName,
 limit: 1,
 });
 const file = data?.[0];
 if (file?.metadata && typeof file.metadata.size === 'number') {
 usedBytes += file.metadata.size;
 }
 } catch {
 // Ignore inaccessible files.
 }
 }));

 const quotaBytes = parseQuotaBytes();
 return {
 usedBytes,
 quotaBytes,
 remainingBytes: Math.max(0, quotaBytes - usedBytes),
 };
}

// GET — list all performances (admin)
export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'performances:read');
 if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

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

 const supabase = getSupabaseAdmin();
 const signedPerformances = await Promise.all(performances.map(async (p) => {
 if (!p.videoStoragePath) return p;
 const { data } = await supabase.storage.from(SUPABASE_STORAGE_BUCKET).createSignedUrl(p.videoStoragePath, 60 * 10);
 return { ...p, videoUrl: data?.signedUrl || p.videoUrl };
 }));

 const videoPaths = performances.map((p) => p.videoStoragePath).filter((u): u is string => !!u);
 const storage = await getVideoStorageStats(videoPaths);

 return NextResponse.json({ performances: signedPerformances, storage: { ...storage, fileCount: videoPaths.length } });
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
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
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
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
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
 if (performance.videoStoragePath) await deleteStoredVideo(performance.videoStoragePath);
 const updated = await prisma.performance.update({
 where: { id: performanceId },
 data: performance.videoStoragePath !== undefined ? { videoUrl: null, videoStoragePath: null } : { videoUrl: null },
 });
 await logAdminAction(admin.userId, 'admin.performance.video_delete', `performanceId=${performanceId}`);
 return NextResponse.json({ success: true, performance: updated });
 }

 if (performance.videoStoragePath) await deleteStoredVideo(performance.videoStoragePath);
 await prisma.performance.delete({ where: { id: performanceId } });
 await logAdminAction(admin.userId, 'admin.performance.delete', `performanceId=${performanceId}`);
 return NextResponse.json({ success: true });
 } catch (error) {
 console.error('Admin performances DELETE:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}
