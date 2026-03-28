import { NextRequest, NextResponse } from 'next/server';
import { fetchExercisesByCategory, fetchExercisesByEquipment, WGER_CATEGORIES, WGER_EQUIPMENT } from '@/lib/wger';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import OpenAI from 'openai';

async function translateToFrench(text: string): Promise<string> {
 const value = text.trim();
 if (!value) return value;

 const apiKey = process.env.OPENAI_API_KEY;
 if (!apiKey) return value;

 try {
 const openai = new OpenAI({ apiKey });
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 temperature: 0,
 max_tokens: 180,
 messages: [
 {
 role: 'system',
 content: 'Traduis en francais naturel et concis pour une application de fitness. Reponds uniquement avec le texte traduit.',
 },
 { role: 'user', content: value },
 ],
 });
 return completion.choices[0]?.message?.content?.trim() || value;
 } catch {
 return value;
 }
}

async function ensureFrenchExercise(exercise: { name: string; description: string }, userId?: string) {
 const sourceName = `wger:${exercise.name.trim().toLowerCase()}`;
 const cached = await prisma.exerciseTranslation.findUnique({ where: { sourceName } });
 if (cached) {
 return {
 ...exercise,
 name: cached.translatedName || exercise.name,
 description: cached.translatedDescription || exercise.description,
 };
 }

 const [translatedName, translatedDescription] = await Promise.all([
 translateToFrench(exercise.name),
 translateToFrench(exercise.description || ''),
 ]);

 await prisma.exerciseTranslation.upsert({
 where: { sourceName },
 create: {
 sourceName,
 translatedName: translatedName || exercise.name,
 translatedDescription: translatedDescription || null,
 sourceApi: 'wger',
 },
 update: {
 translatedName: translatedName || exercise.name,
 translatedDescription: translatedDescription || null,
 },
 });

 return {
 ...exercise,
 name: translatedName || exercise.name,
 description: translatedDescription || exercise.description,
 };
}

export async function GET(req: NextRequest) {
 const { searchParams } = new URL(req.url);
 const muscle = searchParams.get('muscle') ?? '';
 const lieu = searchParams.get('lieu') ?? '';
 const limit = parseInt(searchParams.get('limit') ?? '12');

 try {
 const token = req.headers.get('authorization')?.replace('Bearer ', '');
 const payload = token ? verifyToken(token) : null;
 const userId = payload?.userId;

 let exercises;

 if (muscle && WGER_CATEGORIES[muscle]) {
 exercises = await fetchExercisesByCategory(WGER_CATEGORIES[muscle], limit, userId);
 } else if (lieu && WGER_EQUIPMENT[lieu]) {
 exercises = await fetchExercisesByEquipment(WGER_EQUIPMENT[lieu], limit, userId);
 } else {
 exercises = await fetchExercisesByCategory(11, limit, userId); // default: chest
 }

 const translated = await Promise.all(
 exercises.map((exercise) => ensureFrenchExercise({ name: exercise.name, description: exercise.description }, userId)),
 );
 const merged = exercises.map((exercise, idx) => ({ ...exercise, ...translated[idx] }));

 return NextResponse.json({ exercises: merged });
 } catch (error) {
 console.error('Wger error:', error);
 return NextResponse.json({ error: 'Erreur Wger API' }, { status: 500 });
 }
}
