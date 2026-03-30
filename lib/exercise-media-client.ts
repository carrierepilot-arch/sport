'use client';

import { offlineDB } from '@/lib/offlineDB';
import { listMediaUrlsForPrefetch, normalizeExerciseName } from '@/lib/exercise-media';

export type ExerciseMediaPayload = {
  name: string;
  gifUrl?: string | null;
  animationFrames?: string[] | null;
  instructionFr?: string | null;
  source?: string | null;
};

type CachedMediaRecord = {
  key: string;
  value: ExerciseMediaPayload;
  updatedAt: string;
};

function getCacheKey(name: string): string {
  return `exercise-media:${normalizeExerciseName(name)}`;
}

async function readCachedMedia(name: string): Promise<ExerciseMediaPayload | null> {
  try {
    const record = await offlineDB.get<CachedMediaRecord>('api_cache', getCacheKey(name));
    return record?.value ?? null;
  } catch {
    return null;
  }
}

async function writeCachedMedia(name: string, media: ExerciseMediaPayload): Promise<void> {
  try {
    await offlineDB.put('api_cache', {
      key: getCacheKey(name),
      value: media,
      updatedAt: new Date().toISOString(),
    });
  } catch {
    // non-blocking local cache
  }
}

export function prefetchExerciseMediaAssets(media: ExerciseMediaPayload): void {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
  const urls = listMediaUrlsForPrefetch(media);
  if (!urls.length) return;
  navigator.serviceWorker.ready
    .then((registration) => {
      registration.active?.postMessage({ type: 'CACHE_MEDIA_URLS', urls });
    })
    .catch(() => undefined);
}

export async function fetchExerciseMedia(name: string, token?: string | null): Promise<ExerciseMediaPayload | null> {
  const cached = await readCachedMedia(name);
  try {
    const res = await fetch(`/api/exercise-media?name=${encodeURIComponent(name)}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok && data?.media) {
      const media = data.media as ExerciseMediaPayload;
      await writeCachedMedia(name, media);
      prefetchExerciseMediaAssets(media);
      return media;
    }
  } catch {
    // fallback below
  }
  if (cached) {
    prefetchExerciseMediaAssets(cached);
  }
  return cached;
}