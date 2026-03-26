import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function POST(req: NextRequest) {
  try {
    const { testType, exercices, resultats } = await req.json();

    const lines = exercices.map((ex: string, i: number) =>
      `- ${ex} : ${resultats[i] ?? 0} ${testType === 'statique' ? 'secondes' : 'repetitions'}`
    ).join('\n');

    const prompt = `Tu es un coach sportif expert. Un utilisateur vient de faire un test de niveau en ${testType === 'endurance' ? 'endurance' : testType === 'force' ? 'force' : 'mouvements statiques'} avec ces resultats :

${lines}

Donne une evaluation de son niveau actuel (debutant / intermediaire / confirme / avance) et 2-3 conseils personnalises pour progresser. Sois encourageant et precis. Reponds en francais, 4-5 phrases max.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 400,
      temperature: 0.7,
    });

    const evaluation = completion.choices[0]?.message?.content ?? 'Evaluation indisponible.';
    return NextResponse.json({ evaluation });
  } catch (error) {
    console.error('OpenAI error:', error);
    return NextResponse.json({ error: 'Erreur lors de l\'evaluation.' }, { status: 500 });
  }
}
