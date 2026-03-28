import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { testType, exercices, resultats, manualLevel, manualForce } = body;

 // Save test results to activity log if authenticated
 const token = req.headers.get('authorization')?.replace('Bearer ', '');
 let userId: string | null = null;
 if (token) {
 const payload = verifyToken(token);
 if (payload) {
 userId = payload.userId;
 await prisma.activityLog.create({
 data: {
 userId,
 action: 'level_test',
 details: JSON.stringify({
 testType,
 exercices,
 resultats,
 manualLevel: manualLevel || null,
 manualForce: manualForce || null,
 date: new Date().toISOString(),
 }),
 },
 });
 }
 }

 // For manual level entry, just save — no AI evaluation needed
 if (testType === 'manual') {
 if (userId) {
 await prisma.user.update({
 where: { id: userId },
 data: {
 level: manualLevel || undefined,
 levelTestData: {
 testType,
 exercices,
 resultats,
 manualLevel: manualLevel || null,
 manualForce: manualForce || null,
 savedAt: new Date().toISOString(),
 },
 },
 });
 }
 return NextResponse.json({ evaluation: `Niveau ${manualLevel} enregistré avec succès.`, saved: true });
 }

 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

 const lines = exercices.map((ex: string, i: number) =>
 `- ${ex} : ${resultats[i] ?? 0} ${testType === 'statique' ? 'secondes' : 'repetitions'}`
 ).join('\n');

 const prompt = `Tu es un coach sportif expert. Un utilisateur vient de faire un test de niveau en ${testType === 'endurance' ? 'endurance' : testType === 'force' ? 'force' : 'mouvements statiques'} avec ces resultats :

${lines}

IMPORTANT: Ta premiere ligne doit etre EXACTEMENT un de ces mots: debutant, intermediaire, elite
Ensuite donne une evaluation de son niveau et 2-3 conseils personnalises pour progresser. Sois encourageant et precis. Reponds en francais, 4-5 phrases max.`;

 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 messages: [{ role: 'user', content: prompt }],
 max_tokens: 400,
 temperature: 0.7,
 });

 const evaluation = completion.choices[0]?.message?.content ?? 'Evaluation indisponible.';

 // Extract level from AI response
 const levelMatch = evaluation.toLowerCase().match(/\b(debutant|intermediaire|elite)\b/);
 const detectedLevel = levelMatch ? levelMatch[1] : 'intermediaire';

 if (userId) {
 await prisma.user.update({
 where: { id: userId },
 data: {
 level: detectedLevel,
 levelTestData: {
 testType,
 exercices,
 resultats,
 evaluation,
 detectedLevel,
 savedAt: new Date().toISOString(),
 },
 },
 });
 }

 return NextResponse.json({ evaluation, level: detectedLevel });
 } catch (error) {
 console.error('OpenAI error:', error);
 return NextResponse.json({ error: 'Erreur lors de l\'evaluation.' }, { status: 500 });
 }
}
