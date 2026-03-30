import { NextRequest, NextResponse } from 'next/server';
import { logAdminAction, requireAdminPermission } from '@/lib/admin-auth';
import { list } from '@vercel/blob';
import { checkRateLimit } from '@/lib/simple-rate-limit';

// Extend Vercel Serverless Function timeout (max 30s on hobby, 60s on pro)
export const maxDuration = 30;

// Vercel Hobby plan hard limits
const PLAN_STORAGE_BYTES = 1 * 1024 * 1024 * 1024;    // 1 GB storage
const PLAN_BANDWIDTH_BYTES = 1 * 1024 * 1024 * 1024;  // 1 GB bandwidth/month
const PLAN_DB_BYTES = 256 * 1024 * 1024;              // 256 MB Postgres

type FileInfo = { pathname: string; size: number; contentType: string };
type FileCategory = 'video' | 'image' | 'audio' | 'other';

const EXT_MAP: Record<string, FileCategory> = {
  mp4: 'video', webm: 'video', mov: 'video', avi: 'video', mkv: 'video',
  jpg: 'image', jpeg: 'image', png: 'image', gif: 'image', webp: 'image', avif: 'image', svg: 'image',
  mp3: 'audio', wav: 'audio', ogg: 'audio', aac: 'audio',
};

function classifyPathname(pathname: string): FileCategory {
  const ext = pathname.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MAP[ext] ?? 'other';
}

/** List all blobs, paginating through all results. */
async function listAllBlobs(prefix?: string): Promise<FileInfo[]> {
  const results: FileInfo[] = [];
  let cursor: string | undefined;

  do {
    const page = await list({ limit: 1000, cursor, ...(prefix ? { prefix } : {}) });
    for (const b of page.blobs) {
      results.push({ pathname: b.pathname, size: b.size, contentType: classifyPathname(b.pathname) });
    }
    cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor);

  return results;
}

export async function GET(request: NextRequest) {
  const admin = await requireAdminPermission(request, 'performances:read');
  if (!admin) return NextResponse.json({ error: 'Non autorisé' }, { status: 403 });

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
  const rate = checkRateLimit(`admin-storage:${admin.userId}:${ip}`, 20, 60_000);
  if (!rate.ok) {
    await logAdminAction(
      admin.userId,
      'admin.storage_monitor.rate_limited',
      `ip=${ip} retryAfter=${rate.retryAfterSec}s`,
    );
    return NextResponse.json(
      { error: 'Trop de requêtes. Réessayez dans quelques secondes.' },
      { status: 429, headers: { 'Retry-After': String(rate.retryAfterSec) } },
    );
  }

  try {
    // Restrict monitoring to performance videos only.
    const allFiles = await listAllBlobs('performances/');

    // Group by top-level prefix (first path segment)
    const prefixMap = new Map<string, FileInfo[]>();
    for (const f of allFiles) {
      const prefix = f.pathname.split('/')[0] || '(root)';
      if (!prefixMap.has(prefix)) prefixMap.set(prefix, []);
      prefixMap.get(prefix)!.push(f);
    }

    const prefixStats = Array.from(prefixMap.entries()).map(([name, files]) => {
      const totalBytes = files.reduce((s, f) => s + f.size, 0);
      const byType: Partial<Record<FileCategory, { count: number; bytes: number }>> = {};
      for (const f of files) {
        const cat = classifyPathname(f.contentType);
        if (!byType[cat]) byType[cat] = { count: 0, bytes: 0 };
        byType[cat]!.count += 1;
        byType[cat]!.bytes += f.size;
      }
      return {
        name,
        fileCount: files.length,
        totalBytes,
        byType,
      };
    }).sort((a, b) => b.totalBytes - a.totalBytes);

    const totalUsedBytes = allFiles.reduce((s, f) => s + f.size, 0);
    const totalFileCount = allFiles.length;
    const usedPercent = PLAN_STORAGE_BYTES > 0
      ? Math.min(100, Math.round((totalUsedBytes / PLAN_STORAGE_BYTES) * 100))
      : 0;

    return NextResponse.json({
      updatedAt: new Date().toISOString(),
      storage: {
        usedBytes: totalUsedBytes,
        quotaBytes: PLAN_STORAGE_BYTES,
        remainingBytes: Math.max(0, PLAN_STORAGE_BYTES - totalUsedBytes),
        usedPercent,
        fileCount: totalFileCount,
      },
      bandwidth: {
        quotaBytes: PLAN_BANDWIDTH_BYTES,
        note: 'Bande passante non disponible via l\'API Vercel Blob',
      },
      limits: {
        storage: { bytes: PLAN_STORAGE_BYTES, label: '1 GB' },
        bandwidth: { bytes: PLAN_BANDWIDTH_BYTES, label: '1 GB/mois' },
        database: { bytes: PLAN_DB_BYTES, label: '256 MB (Neon)' },
      },
      buckets: prefixStats,
    });
  } catch (error) {
    console.error('Admin storage-stats GET:', error);
    return NextResponse.json({ error: 'Erreur serveur interne' }, { status: 500 });
  }
}
