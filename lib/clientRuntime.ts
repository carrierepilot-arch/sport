'use client';

import { offlineDB } from '@/lib/offlineDB';

export interface SessionUser {
  id: string;
  email: string;
  name?: string | null;
  pseudo?: string | null;
  isAdmin?: boolean;
  level?: string;
  xp?: number;
  equipmentData?: Record<string, unknown> | null;
  levelTestData?: unknown;
}

interface StoredSession {
  token: string;
  user: SessionUser;
  persistedAt: string;
}

interface QueuedMutation {
  id: string;
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  createdAt: string;
}

type ApiCacheEntry = {
  data: unknown;
  updatedAt: string;
};

const SESSION_KEY = 'sport.session.v1';
const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const QUEUE_KEY = 'sport.offline.queue.v1';
const API_CACHE_KEY = 'sport.api.cache.v1';
const PHYSICAL_KEY = 'sport.user.physical.v1';

function isBrowser() {
  return typeof window !== 'undefined';
}

function safeParse<T>(value: string | null, fallback: T): T {
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function normalizeUser(user: Partial<SessionUser> | null | undefined): SessionUser {
  return {
    id: String(user?.id ?? 'offline-user'),
    email: String(user?.email ?? 'demo@sport.local'),
    name: user?.name ?? 'Utilisateur',
    pseudo: user?.pseudo ?? null,
    isAdmin: user?.isAdmin ?? false,
    level: user?.level ?? 'intermediaire',
    xp: typeof user?.xp === 'number' ? user.xp : 0,
    equipmentData: (user?.equipmentData as Record<string, unknown> | null | undefined) ?? null,
    levelTestData: user?.levelTestData ?? null,
  };
}

function readQueue(): QueuedMutation[] {
  if (!isBrowser()) return [];
  return safeParse<QueuedMutation[]>(window.localStorage.getItem(QUEUE_KEY), []);
}

function writeQueue(queue: QueuedMutation[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

function readApiCacheMap(): Record<string, ApiCacheEntry> {
  if (!isBrowser()) return {};
  return safeParse<Record<string, ApiCacheEntry>>(window.localStorage.getItem(API_CACHE_KEY), {});
}

function writeApiCacheMap(cache: Record<string, ApiCacheEntry>) {
  if (!isBrowser()) return;
  window.localStorage.setItem(API_CACHE_KEY, JSON.stringify(cache));
}

function cacheApiResponse(url: string, data: unknown) {
  if (!isBrowser()) return;
  const cache = readApiCacheMap();
  cache[url] = { data, updatedAt: new Date().toISOString() };
  writeApiCacheMap(cache);
}

export function getCachedApiResponse<T>(url: string): T | null {
  const cache = readApiCacheMap();
  return (cache[url]?.data as T | undefined) ?? null;
}

function enqueueMutation(mutation: Omit<QueuedMutation, 'id' | 'createdAt'>) {
  const queue = readQueue();
  queue.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: new Date().toISOString(),
    ...mutation,
  });
  writeQueue(queue);
}

function toJsonResponse(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

function readPhysicalEntries(): unknown[] {
  if (!isBrowser()) return [];
  return safeParse<unknown[]>(window.localStorage.getItem(PHYSICAL_KEY), []);
}

function writePhysicalEntries(entries: unknown[]) {
  if (!isBrowser()) return;
  window.localStorage.setItem(PHYSICAL_KEY, JSON.stringify(entries));
}

function createOfflineSession(email?: string): StoredSession {
  const user = normalizeUser({
    id: 'offline-user',
    email: email?.trim() || 'demo@sport.local',
    name: 'Utilisateur local',
  });

  return {
    token: `offline-${Date.now()}`,
    user,
    persistedAt: new Date().toISOString(),
  };
}

async function persistUserInOfflineDb(user: SessionUser) {
  try {
    await offlineDB.init();
    await offlineDB.put('users', {
      id: user.id,
      nom: user.name ?? user.pseudo ?? 'Utilisateur',
      email: user.email,
      level: user.level ?? 'intermediaire',
      xp: user.xp ?? 0,
    });
  } catch {
    // Local storage remains the source of truth when IndexedDB is unavailable.
  }
}

export async function persistSession(token: string, user: Partial<SessionUser>) {
  if (!isBrowser()) return null;
  const normalizedUser = normalizeUser(user);
  const session: StoredSession = {
    token,
    user: normalizedUser,
    persistedAt: new Date().toISOString(),
  };

  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(normalizedUser));
  window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));

  await persistUserInOfflineDb(normalizedUser);

  return session;
}

export function getStoredSession(): StoredSession | null {
  if (!isBrowser()) return null;

  const session = safeParse<StoredSession | null>(window.localStorage.getItem(SESSION_KEY), null);
  if (session?.token && session?.user) {
    return {
      ...session,
      user: normalizeUser(session.user),
    };
  }

  const token = window.localStorage.getItem(TOKEN_KEY);
  const user = safeParse<SessionUser | null>(window.localStorage.getItem(USER_KEY), null);
  if (!token || !user) return null;

  return {
    token,
    user: normalizeUser(user),
    persistedAt: new Date().toISOString(),
  };
}

export function updateStoredUser(patch: Partial<SessionUser>) {
  const current = getStoredSession();
  if (!current) return null;
  const nextUser = normalizeUser({ ...current.user, ...patch });
  window.localStorage.setItem(USER_KEY, JSON.stringify(nextUser));
  window.localStorage.setItem(SESSION_KEY, JSON.stringify({
    ...current,
    user: nextUser,
    persistedAt: new Date().toISOString(),
  }));
  void persistUserInOfflineDb(nextUser);
  return nextUser;
}

export function clearStoredSession() {
  if (!isBrowser()) return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(SESSION_KEY);
  window.localStorage.removeItem(QUEUE_KEY);
  window.localStorage.removeItem(API_CACHE_KEY);
}

function getDefaultOfflinePayload(pathname: string) {
  if (pathname === '/api/sections/status') return { sections: [] };
  if (pathname === '/api/friends/pending-count') return { count: 0 };
  if (pathname === '/api/messages/conversations') return { conversations: [] };
  if (pathname === '/api/messages/admin-inbox/unread-count') return { unreadCount: 0 };
  if (pathname === '/api/user/equipment') return { equipmentData: getStoredSession()?.user.equipmentData ?? {} };
  if (pathname === '/api/user/physical') return { entries: readPhysicalEntries() };
  if (pathname === '/api/workouts/list') return { workouts: [] };
  if (pathname === '/api/badges') return { badges: [] };
  if (pathname === '/api/analytics') {
    return {
      totalWorkouts: 0,
      totalCompleted: 0,
      totalMinutes: 0,
      totalSeries: 0,
      totalReps: 0,
      streak: 0,
      thisWeekSessions: 0,
      weeklyData: [],
      topExercises: [],
      monthlyData: [],
      avgMinutes: 0,
      challengesCompleted: 0,
      xp: getStoredSession()?.user.xp ?? 0,
    };
  }

  if (pathname.includes('/leaderboard')) return { leaderboard: [], entries: [] };
  if (pathname.startsWith('/api/friends')) return { friends: [], requests: [], count: 0 };
  if (pathname.startsWith('/api/groups')) return { groups: [], messages: [] };
  if (pathname.startsWith('/api/feed')) return { posts: [], items: [] };
  if (pathname.startsWith('/api/challenges')) return { challenges: [], items: [] };
  if (pathname.startsWith('/api/performances')) return { spots: [], performances: [], leaderboard: [] };
  if (pathname.startsWith('/api/suggestions')) return { suggestions: [] };
  if (pathname.startsWith('/api/messages')) return { messages: [], conversations: [] };

  return { success: true };
}

function getRequestBody(init?: RequestInit): unknown {
  if (!init?.body || typeof init.body !== 'string') return null;
  try {
    return JSON.parse(init.body);
  } catch {
    return init.body;
  }
}

function buildOfflineApiResponse(pathname: string, init?: RequestInit): Response | null {
  const method = (init?.method ?? 'GET').toUpperCase();
  const session = getStoredSession();
  const body = getRequestBody(init) as Record<string, unknown> | null;

  if (pathname === '/api/auth/login' && method === 'POST') {
    const existing = session ?? createOfflineSession(typeof body?.email === 'string' ? body.email : undefined);
    if (!session) {
      void persistSession(existing.token, existing.user);
    }
    return toJsonResponse({ success: true, token: existing.token, user: existing.user });
  }

  if (pathname === '/api/auth/register' && method === 'POST') {
    const created = createOfflineSession(typeof body?.email === 'string' ? body.email : undefined);
    created.user.name = typeof body?.name === 'string' && body.name.trim() ? body.name.trim() : created.user.name;
    void persistSession(created.token, created.user);
    return toJsonResponse({ success: true, token: created.token, user: created.user }, 201);
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    if (!session) return toJsonResponse({ error: 'Non authentifie' }, 401);
    return toJsonResponse({ user: session.user });
  }

  if (pathname === '/api/user/update' && method === 'PATCH') {
    const nextUser = updateStoredUser({
      name: typeof body?.name === 'string' ? body.name : session?.user.name,
      pseudo: typeof body?.pseudo === 'string' ? body.pseudo : session?.user.pseudo,
      level: typeof body?.level === 'string' ? body.level : session?.user.level,
      levelTestData: body?.levelTestData ?? session?.user.levelTestData,
    });
    enqueueMutation({
      url: pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: init?.body as string | undefined,
    });
    return toJsonResponse({ success: true, user: nextUser ?? session?.user ?? normalizeUser(null) });
  }

  if (pathname === '/api/user/equipment' && method === 'POST') {
    const equipmentData = (body?.equipmentData as Record<string, unknown> | undefined) ?? {};
    updateStoredUser({ equipmentData });
    cacheApiResponse(pathname, { equipmentData });
    enqueueMutation({
      url: pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: init?.body as string | undefined,
    });
    return toJsonResponse({ success: true });
  }

  if (pathname === '/api/user/equipment' && method === 'GET') {
    return toJsonResponse({ equipmentData: session?.user.equipmentData ?? {} });
  }

  if (pathname === '/api/user/physical' && method === 'POST') {
    const entries = readPhysicalEntries();
    const nextEntries = [{ date: new Date().toISOString(), ...(body ?? {}) }, ...entries];
    writePhysicalEntries(nextEntries);
    cacheApiResponse(pathname, { entries: nextEntries });
    enqueueMutation({
      url: pathname,
      method,
      headers: { 'Content-Type': 'application/json' },
      body: init?.body as string | undefined,
    });
    return toJsonResponse({ success: true, entries: nextEntries });
  }

  if (pathname === '/api/user/physical' && method === 'GET') {
    return toJsonResponse({ entries: readPhysicalEntries() });
  }

  if (pathname === '/api/analytics/reset' && method === 'DELETE') {
    writePhysicalEntries([]);
    cacheApiResponse('/api/analytics', getDefaultOfflinePayload('/api/analytics'));
    enqueueMutation({
      url: pathname,
      method,
      headers: {},
    });
    return toJsonResponse({ success: true });
  }

  if (pathname === '/api/feed' && method === 'POST') {
    const content = typeof body?.content === 'string' ? body.content : '';
    const author = session?.user ?? normalizeUser(null);
    const offlinePost = {
      id: `offline-post-${Date.now()}`,
      content,
      createdAt: new Date().toISOString(),
      author: {
        id: author.id,
        pseudo: author.pseudo ?? author.name ?? 'moi',
      },
      likeCount: 0,
      likedByMe: false,
      replyCount: 0,
      replies: [],
    };
    enqueueMutation({
      url: pathname,
      method,
      headers: init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init?.headers as Record<string, string> | undefined) ?? {},
      body: init?.body as string | undefined,
    });
    return toJsonResponse({ success: true, queued: true, post: offlinePost });
  }

  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    enqueueMutation({
      url: pathname,
      method,
      headers: init?.headers instanceof Headers ? Object.fromEntries(init.headers.entries()) : (init?.headers as Record<string, string> | undefined) ?? {},
      body: init?.body as string | undefined,
    });
  }

  const cached = getCachedApiResponse<unknown>(pathname);
  if (cached != null) {
    return toJsonResponse(cached);
  }

  return toJsonResponse(getDefaultOfflinePayload(pathname));
}

async function cacheSuccessfulOnlineResponse(pathname: string, response: Response) {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.includes('application/json')) return;

  try {
    const payload = await response.clone().json();
    cacheApiResponse(pathname, payload);

    if ((pathname === '/api/auth/login' || pathname === '/api/auth/register') && payload?.token && payload?.user) {
      await persistSession(payload.token as string, payload.user as SessionUser);
    }

    if (pathname === '/api/auth/me' && payload?.user) {
      updateStoredUser(payload.user as Partial<SessionUser>);
    }

    if (pathname === '/api/user/equipment' && payload?.equipmentData) {
      updateStoredUser({ equipmentData: payload.equipmentData as Record<string, unknown> });
    }

    if (pathname === '/api/user/physical' && Array.isArray(payload?.entries)) {
      writePhysicalEntries(payload.entries as unknown[]);
    }
  } catch {
    // Ignore cache failures.
  }
}

function resolveApiPath(input: RequestInfo | URL): string | null {
  const raw = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
  try {
    const url = raw.startsWith('http') ? new URL(raw) : new URL(raw, window.location.origin);
    return url.pathname.startsWith('/api/') ? url.pathname : null;
  } catch {
    return raw.startsWith('/api/') ? raw : null;
  }
}

function getApiBaseUrl() {
  const runtimeValue = (window as typeof window & { __SPORT_API_BASE_URL__?: string }).__SPORT_API_BASE_URL__;
  const envValue = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (runtimeValue) return runtimeValue;
  if (envValue) return envValue;

  const isCapacitorRuntime = typeof (window as typeof window & { Capacitor?: unknown }).Capacitor !== 'undefined';
  const isAppWebViewOrigin = ['capacitor:', 'file:'].includes(window.location.protocol);

  if (isCapacitorRuntime || isAppWebViewOrigin) {
    // Stable project-domain alias for production API.
    return 'https://sport-carrierepilot-8919s-projects.vercel.app';
  }

  return '';
}

function resolveApiRequestInput(input: RequestInfo | URL): RequestInfo | URL {
  if (!isBrowser()) return input;
  const pathname = resolveApiPath(input);
  if (!pathname) return input;
  const baseUrl = getApiBaseUrl().trim();
  if (!baseUrl) return pathname;
  return `${baseUrl.replace(/\/$/, '')}${pathname}`;
}

export async function flushQueuedMutations() {
  if (!isBrowser() || !window.navigator.onLine) return;
  const queue = readQueue();
  if (queue.length === 0) return;

  const originalFetch = window.fetch.bind(window);
  const remaining: QueuedMutation[] = [];

  for (const item of queue) {
    try {
      const response = await originalFetch(resolveApiRequestInput(item.url), {
        method: item.method,
        headers: item.headers,
        body: item.body,
      });

      if (!response.ok) {
        remaining.push(item);
      }
    } catch {
      remaining.push(item);
    }
  }

  writeQueue(remaining);
}

export function installOfflineRuntime() {
  if (!isBrowser()) return;

  const runtimeWindow = window as typeof window & { __sportFetchPatched__?: boolean };
  if (runtimeWindow.__sportFetchPatched__) return;

  runtimeWindow.__sportFetchPatched__ = true;
  const originalFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const pathname = resolveApiPath(input);
    if (!pathname) {
      return originalFetch(input, init);
    }

    if (!window.navigator.onLine) {
      const offlineResponse = buildOfflineApiResponse(pathname, init);
      if (offlineResponse) return offlineResponse;
    }

    try {
      const response = await originalFetch(resolveApiRequestInput(input), init);
      await cacheSuccessfulOnlineResponse(pathname, response);
      return response;
    } catch {
      const offlineResponse = buildOfflineApiResponse(pathname, init);
      if (offlineResponse) return offlineResponse;
      throw new Error('Network request failed and no offline fallback is available.');
    }
  };
}

export async function createAndPersistOfflineSession(input?: { email?: string; name?: string | null }) {
  const session = createOfflineSession(input?.email);
  if (input?.name && input.name.trim()) {
    session.user.name = input.name.trim();
  }
  await persistSession(session.token, session.user);
  return session;
}