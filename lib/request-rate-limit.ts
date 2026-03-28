import { NextRequest, NextResponse } from 'next/server';
import { getAdminControlConfig } from '@/lib/admin-control-config';

type RateState = {
  windowStart: number;
  count: number;
};

const globalState = globalThis as unknown as {
  __sportRateMap?: Map<string, RateState>;
};

const RATE_MAP = globalState.__sportRateMap ?? new Map<string, RateState>();
if (!globalState.__sportRateMap) globalState.__sportRateMap = RATE_MAP;

function identityFromRequest(request: NextRequest): string {
  const auth = request.headers.get('authorization')?.replace('Bearer ', '').trim();
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const ip = forwardedFor || request.headers.get('x-real-ip') || 'unknown';
  return auth ? `token:${auth.slice(0, 80)}` : `ip:${ip}`;
}

export async function enforceRequestRateLimit(request: NextRequest): Promise<NextResponse | null> {
  const config = await getAdminControlConfig();
  const rl = config.rateLimit;

  if (!rl.enabled) return null;
  if (rl.mutatingOnly && request.method === 'GET') return null;

  const now = Date.now();
  const key = `${request.method}:${identityFromRequest(request)}`;
  const current = RATE_MAP.get(key);

  if (!current || now - current.windowStart >= rl.windowMs) {
    RATE_MAP.set(key, { windowStart: now, count: 1 });
    return null;
  }

  if (current.count >= rl.maxRequests) {
    return NextResponse.json(
      {
        error: 'Trop de requetes. Merci de ralentir pour proteger le serveur.',
        code: 'RATE_LIMIT_EXCEEDED',
        retryAfterMs: Math.max(0, rl.windowMs - (now - current.windowStart)),
      },
      { status: 429 },
    );
  }

  current.count += 1;
  RATE_MAP.set(key, current);
  return null;
}
