import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

export async function POST(req: NextRequest) {
 try {
 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 const { programme } = await req.json();

 if (!programme?.trim()) {
 return NextResponse.json({ error: 'Programme vide.' }, { status: 400 });
 }

 const prompt = `Tu es un coach sportif expert en street workout et fitness. Analyse ce programme d'entrainement cree par un utilisateur et donne un feedback constructif en francais (3-4 phrases max) :

Programme :
${programme}

Indique :
- Si le programme est bien structure (bon / peut etre ameliore / a revoir)
- Les points forts
- Une suggestion concrete d'amelioration si necessaire
- Encourage l'utilisateur

Commence directement par le feedback, sans titre.`;

 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 messages: [{ role: 'user', content: prompt }],
 max_tokens: 300,
 temperature: 0.7,
 });

 const feedback = completion.choices[0]?.message?.content ?? 'Feedback indisponible.';
 return NextResponse.json({ feedback });
 } catch (error) {
 console.error('OpenAI error:', error);
 return NextResponse.json({ error: 'Erreur lors de l\'analyse.' }, { status: 500 });
 }
}
