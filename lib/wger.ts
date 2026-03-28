// Wger Workout Manager API helpers
// https://wger.de/api/v2/
import { logApiCall } from '@/lib/api-logger';

const BASE = 'https://wger.de/api/v2';
const TOKEN = process.env.WGER_API_TOKEN;

const headers = {
  Authorization: `Token ${TOKEN}`,
  'Content-Type': 'application/json',
};

// Wger exercise category IDs
export const WGER_CATEGORIES: Record<string, number> = {
  Pectoraux:   11,
  Dos:         12,
  Epaules:     13,
  Biceps:       8,
  Triceps:      8,
  Abdominaux:  10,
  Jambes:       9,
};

// Wger equipment IDs (relevant ones)
export const WGER_EQUIPMENT: Record<string, number> = {
  'Salle de sport':  1, // barbell
  'Maison':          7, // body weight
  'Street workout':  7, // body weight
};

export interface WgerExercise {
  id: number;
  name: string;
  description: string;
  category: { name: string };
  muscles: { name_en: string }[];
  equipment: { name: string }[];
}

function pickBestTranslation(
  translations: Array<{ name?: string; description?: string; language?: number | { id?: number; short_name?: string; full_name?: string } }> = [],
) {
  if (!translations.length) return { name: '', description: '' };

  const french = translations.find((t) => {
    const lang = t.language;
    if (typeof lang === 'number') return lang === 2;
    const short = lang?.short_name?.toLowerCase();
    const full = lang?.full_name?.toLowerCase();
    return short === 'fr' || full?.includes('french');
  });

  const english = translations.find((t) => {
    const lang = t.language;
    if (typeof lang === 'number') return lang === 1;
    const short = lang?.short_name?.toLowerCase();
    const full = lang?.full_name?.toLowerCase();
    return short === 'en' || full?.includes('english');
  });

  return french || english || translations[0] || { name: '', description: '' };
}

function cleanHtml(html: string): string {
  return (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
}

export async function fetchExercisesByCategory(categoryId: number, limit = 20, userId?: string): Promise<WgerExercise[]> {
  try {
    const url = `${BASE}/exerciseinfo/?format=json&language=2&category=${categoryId}&limit=${limit}&offset=0`;
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    await logApiCall({
      apiName: 'wger',
      endpoint: url,
      requestPayload: { categoryId, limit },
      responseStatus: res.status,
      userId,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((ex: { id: number; translations: Array<{ name?: string; description?: string; language?: number | { id?: number; short_name?: string; full_name?: string } }>; category: { name: string }; muscles: { name_en: string }[]; equipment: { name: string }[] }) => {
      const tr = pickBestTranslation(ex.translations);
      return {
      id: ex.id,
      name: tr.name ?? `Exercise ${ex.id}`,
      description: cleanHtml(tr.description ?? ''),
      category: ex.category,
      muscles: ex.muscles,
      equipment: ex.equipment,
      };
    });
  } catch {
    await logApiCall({
      apiName: 'wger',
      endpoint: `${BASE}/exerciseinfo/`,
      requestPayload: { categoryId, limit },
      responseStatus: 500,
      userId,
    });
    return [];
  }
}

export async function fetchExercisesByEquipment(equipmentId: number, limit = 20, userId?: string): Promise<WgerExercise[]> {
  try {
    const url = `${BASE}/exerciseinfo/?format=json&language=2&equipment=${equipmentId}&limit=${limit}&offset=0`;
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    await logApiCall({
      apiName: 'wger',
      endpoint: url,
      requestPayload: { equipmentId, limit },
      responseStatus: res.status,
      userId,
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((ex: { id: number; translations: Array<{ name?: string; description?: string; language?: number | { id?: number; short_name?: string; full_name?: string } }>; category: { name: string }; muscles: { name_en: string }[]; equipment: { name: string }[] }) => {
      const tr = pickBestTranslation(ex.translations);
      return {
      id: ex.id,
      name: tr.name ?? `Exercise ${ex.id}`,
      description: cleanHtml(tr.description ?? ''),
      category: ex.category,
      muscles: ex.muscles,
      equipment: ex.equipment,
      };
    });
  } catch {
    await logApiCall({
      apiName: 'wger',
      endpoint: `${BASE}/exerciseinfo/`,
      requestPayload: { equipmentId, limit },
      responseStatus: 500,
      userId,
    });
    return [];
  }
}
