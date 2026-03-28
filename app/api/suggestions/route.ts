import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';
import { enforceRequestRateLimit } from '@/lib/request-rate-limit';

async function requireUser(request: NextRequest) {
 const authHeader = request.headers.get('authorization');
 const token = authHeader?.replace('Bearer ', '');
 if (!token) return null;
 return verifyToken(token);
}

export async function GET(request: NextRequest) {
 try {
 const payload = await requireUser(request);
 if (!payload) return NextResponse.json({ error: 'Acces refuse' }, { status: 401 });

 try {
 const suggestions = await prisma.suggestion.findMany({
 where: { userId: payload.userId },
 orderBy: { createdAt: 'desc' },
 take: 50,
 });
 return NextResponse.json({ suggestions });
 } catch {
 return NextResponse.json({ suggestions: [], unavailable: true });
 }
 } catch (error) {
 console.error('Suggestions GET error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}

export async function POST(request: NextRequest) {
 try {
 const limited = await enforceRequestRateLimit(request);
 if (limited) return limited;

 const payload = await requireUser(request);
 if (!payload) return NextResponse.json({ error: 'Acces refuse' }, { status: 401 });

 const body = await request.json().catch(() => ({}));
 const text = typeof body.text === 'string' ? body.text.trim() : '';
 const category = typeof body.category === 'string' ? body.category.trim().toLowerCase() : 'general';

 if (text.length < 8) {
 return NextResponse.json({ error: 'Decris un peu plus ton idee (minimum 8 caracteres).' }, { status: 400 });
 }
 if (text.length > 1200) {
 return NextResponse.json({ error: 'Ton idee est trop longue (maximum 1200 caracteres).' }, { status: 400 });
 }

 const allowedCategory = ['general', 'ui', 'fonctionnalite', 'bug', 'performance'].includes(category)
 ? category
 : 'general';

 try {
 const suggestion = await prisma.suggestion.create({
 data: {
 userId: payload.userId,
 text,
 category: allowedCategory,
 },
 });
 return NextResponse.json({ suggestion }, { status: 201 });
 } catch {
 return NextResponse.json({ error: 'La table des suggestions nest pas encore disponible. Lance la migration Prisma.' }, { status: 503 });
 }
 } catch (error) {
 console.error('Suggestions POST error:', error);
 return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
 }
}