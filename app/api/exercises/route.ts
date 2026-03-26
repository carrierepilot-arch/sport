import { NextRequest, NextResponse } from 'next/server';

const BASE = 'https://exercisedb.p.rapidapi.com';
const HEADERS = {
  'x-rapidapi-key': process.env.RAPIDAPI_KEY ?? '',
  'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
};

// Mapping muscles FR -> bodyPart ExerciseDB
const MUSCLE_TO_BODYPART: Record<string, string> = {
  'Pectoraux':   'chest',
  'Dos':         'back',
  'Epaules':     'shoulders',
  'Biceps':      'upper arms',
  'Triceps':     'upper arms',
  'Abdominaux':  'waist',
  'Jambes':      'upper legs',
};

// Mapping lieu -> equipment hint
const LIEU_TO_EQUIPMENT: Record<string, string> = {
  'Salle de sport':  'barbell',
  'Maison':          'body weight',
  'Street workout':  'body weight',
};

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const muscle  = searchParams.get('muscle');
  const lieu    = searchParams.get('lieu');
  const limit   = parseInt(searchParams.get('limit') ?? '6');

  try {
    let url: string;

    if (muscle && MUSCLE_TO_BODYPART[muscle]) {
      url = `${BASE}/exercises/bodyPart/${encodeURIComponent(MUSCLE_TO_BODYPART[muscle])}?limit=${limit}&offset=0`;
    } else if (lieu && LIEU_TO_EQUIPMENT[lieu]) {
      url = `${BASE}/exercises/equipment/${encodeURIComponent(LIEU_TO_EQUIPMENT[lieu])}?limit=${limit}&offset=0`;
    } else {
      url = `${BASE}/exercises/bodyPart/chest?limit=${limit}&offset=0`;
    }

    const res = await fetch(url, { headers: HEADERS, cache: 'force-cache' });

    if (!res.ok) {
      return NextResponse.json({ error: `ExerciseDB error: ${res.status}` }, { status: res.status });
    }

    const data = await res.json();
    return NextResponse.json({ exercises: data });
  } catch (error) {
    console.error('ExerciseDB error:', error);
    return NextResponse.json({ error: 'Erreur connexion ExerciseDB.' }, { status: 500 });
  }
}
