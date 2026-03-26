// Wger Workout Manager API helpers
// https://wger.de/api/v2/

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

export async function fetchExercisesByCategory(categoryId: number, limit = 20): Promise<WgerExercise[]> {
  try {
    const url = `${BASE}/exerciseinfo/?format=json&language=2&category=${categoryId}&limit=${limit}&offset=0`;
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((ex: { id: number; translations: { name: string; description: string }[]; category: { name: string }; muscles: { name_en: string }[]; equipment: { name: string }[] }) => ({
      id: ex.id,
      name: ex.translations?.[0]?.name ?? `Exercise ${ex.id}`,
      description: ex.translations?.[0]?.description ?? '',
      category: ex.category,
      muscles: ex.muscles,
      equipment: ex.equipment,
    }));
  } catch {
    return [];
  }
}

export async function fetchExercisesByEquipment(equipmentId: number, limit = 20): Promise<WgerExercise[]> {
  try {
    const url = `${BASE}/exerciseinfo/?format=json&language=2&equipment=${equipmentId}&limit=${limit}&offset=0`;
    const res = await fetch(url, { headers, next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results ?? []).map((ex: { id: number; translations: { name: string; description: string }[]; category: { name: string }; muscles: { name_en: string }[]; equipment: { name: string }[] }) => ({
      id: ex.id,
      name: ex.translations?.[0]?.name ?? `Exercise ${ex.id}`,
      description: ex.translations?.[0]?.description ?? '',
      category: ex.category,
      muscles: ex.muscles,
      equipment: ex.equipment,
    }));
  } catch {
    return [];
  }
}
