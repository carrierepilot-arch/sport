import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { testType, exercices, resultats, manualLevel, manualForce, forceRMType, forceRepsPerExo } = body;

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

 let lines: string;
 let prompt: string;

 if (testType === 'force' && forceRMType) {
 // Force test: 1RM / 2RM / 3RM with kg weights
 lines = exercices.map((ex: string, i: number) => {
 const kg = resultats[i] ?? 0;
 const reps = forceRepsPerExo?.[i] ?? (forceRMType === '1RM' ? 1 : forceRMType === '2RM' ? 2 : 3);
 // Estimate 1RM using Epley formula: 1RM = weight × (1 + reps/30)
 const estimated1RM = reps > 1 ? Math.round(kg * (1 + reps / 30) * 10) / 10 : kg;
 return `- ${ex} : ${kg} kg x ${reps} reps (1RM estime: ${estimated1RM} kg)`;
 }).join('\n');

 prompt = `Tu es un coach sportif expert en force et street workout. Un utilisateur a renseigne ses charges maximales (${forceRMType}) :

${lines}

Baremes de reference pour evaluer le niveau en force lestee (street workout / callisthenie) :
- DEBUTANT : Tractions lestees < 10kg, Dips lestes < 10kg, Squats lestes < 20kg
- INTERMEDIAIRE : Tractions lestees 10-25kg, Dips lestes 10-25kg, Squats lestes 20-60kg
- ELITE : Tractions lestees > 25kg, Dips lestes > 25kg, Squats lestes > 60kg

IMPORTANT: Ta premiere ligne doit etre EXACTEMENT un de ces mots: debutant, intermediaire, elite
Ensuite evalue son niveau de force et donne 2-3 conseils pour progresser en charges lourdes. Sois precis sur les axes d'amelioration. Reponds en francais, 4-5 phrases max.`;
 } else if (testType === 'statique') {
 // Positional / static hold test
 lines = exercices.map((ex: string, i: number) =>
 `- ${ex} : ${resultats[i] ?? 0} secondes de maintien`
 ).join('\n');

 prompt = `Tu es un coach sportif expert. Un utilisateur a realise un test positionnel (maintien statique) avec ces resultats :

${lines}

Ces tests evaluent la maitrise des positions fondamentales en callisthenie :
- Traction menton au-dessus de la barre = controle de la position haute de traction
- Dips position haute = stabilite des epaules et verrouillage des bras
- Dips position basse = mobilite et force en fin de mouvement
- Pompes position intermediaire = gainage et force isometrique

Baremes :
- DEBUTANT : < 5 secondes de maintien en moyenne
- INTERMEDIAIRE : 5-15 secondes de maintien en moyenne
- ELITE : > 15 secondes de maintien en moyenne

IMPORTANT: Ta premiere ligne doit etre EXACTEMENT un de ces mots: debutant, intermediaire, elite
Ensuite evalue son niveau et donne 2-3 conseils pour ameliorer ses positions. Reponds en francais, 4-5 phrases max.`;
 } else {
 // Endurance test (default)
 lines = exercices.map((ex: string, i: number) =>
 `- ${ex} : ${resultats[i] ?? 0} repetitions`
 ).join('\n');

 prompt = `Tu es un coach sportif expert. Un utilisateur vient de faire un test de niveau en endurance avec ces resultats :

${lines}

IMPORTANT: Ta premiere ligne doit etre EXACTEMENT un de ces mots: debutant, intermediaire, elite
Ensuite donne une evaluation de son niveau et 2-3 conseils personnalises pour progresser. Sois encourageant et precis. Reponds en francais, 4-5 phrases max.`;
 }

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
 ...(forceRMType ? { forceRMType, forceRepsPerExo } : {}),
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
