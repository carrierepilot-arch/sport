import { NextRequest, NextResponse } from 'next/server';
import { fetchExercisesByCategory, fetchExercisesByEquipment, WGER_CATEGORIES, WGER_EQUIPMENT } from '@/lib/wger';

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const muscle = searchParams.get('muscle') ?? '';
  const lieu   = searchParams.get('lieu') ?? '';
  const limit  = parseInt(searchParams.get('limit') ?? '12');

  try {
    let exercises;

    if (muscle && WGER_CATEGORIES[muscle]) {
      exercises = await fetchExercisesByCategory(WGER_CATEGORIES[muscle], limit);
    } else if (lieu && WGER_EQUIPMENT[lieu]) {
      exercises = await fetchExercisesByEquipment(WGER_EQUIPMENT[lieu], limit);
    } else {
      exercises = await fetchExercisesByCategory(11, limit); // default: chest
    }

    return NextResponse.json({ exercises });
  } catch (error) {
    console.error('Wger error:', error);
    return NextResponse.json({ error: 'Erreur Wger API' }, { status: 500 });
  }
}
