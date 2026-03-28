import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { prisma } from '@/lib/prisma';
import { logApiCall } from '@/lib/api-logger';
import { requireAdminPermission } from '@/lib/admin-auth';

export async function POST(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'api-test:write');
 if (!admin) return NextResponse.json({ error: 'Accès refusé' }, { status: 403 });

 try {
 const body = await request.json();
 const provider = String(body.provider || '').toLowerCase();
 const query = String(body.query || '').trim();
 if (!provider || !query) {
 return NextResponse.json({ error: 'provider et query requis' }, { status: 400 });
 }

 if (provider === 'exercisedb') {
 const endpoint = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(query)}?limit=5&offset=0`;
 const res = await fetch(endpoint, {
 headers: {
 'x-rapidapi-key': process.env.RAPIDAPI_KEY || '',
 'x-rapidapi-host': 'exercisedb.p.rapidapi.com',
 },
 });
 const data = await res.json().catch(() => null);
 await logApiCall({ apiName: 'exerciseDB', endpoint, requestPayload: { query, source: 'admin-test' }, responseStatus: res.status, userId: admin.userId });
 return NextResponse.json({ provider: 'exerciseDB', status: res.status, data });
 }

 if (provider === 'wger') {
 const endpoint = `https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=5&term=${encodeURIComponent(query)}`;
 const res = await fetch(endpoint, {
 headers: {
 Authorization: `Token ${process.env.WGER_API_TOKEN || ''}`,
 },
 });
 const data = await res.json().catch(() => null);
 await logApiCall({ apiName: 'wger', endpoint, requestPayload: { query, source: 'admin-test' }, responseStatus: res.status, userId: admin.userId });
 return NextResponse.json({ provider: 'wger', status: res.status, data });
 }

 if (provider === 'ncbi') {
 const endpoint = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=5&term=${encodeURIComponent(query)}`;
 const res = await fetch(endpoint);
 const data = await res.json().catch(() => null);
 await logApiCall({ apiName: 'ncbi', endpoint, requestPayload: { query, source: 'admin-test' }, responseStatus: res.status, userId: admin.userId });
 return NextResponse.json({ provider: 'ncbi', status: res.status, data });
 }

 if (provider === 'openai') {
 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 temperature: 0,
 max_tokens: 150,
 messages: [{ role: 'user', content: query }],
 });

 const tokens = completion.usage?.total_tokens ?? 0;
 const costEstimate = tokens * 0.00000015;
 await logApiCall({
 apiName: 'openai',
 endpoint: 'chat.completions.create',
 requestPayload: { query, source: 'admin-test' },
 responseStatus: 200,
 tokensUsed: tokens,
 costEstimate,
 userId: admin.userId,
 });
 return NextResponse.json({ provider: 'openai', status: 200, data: completion });
 }

 return NextResponse.json({ error: 'provider non supporté' }, { status: 400 });
 } catch (error) {
 const msg = error instanceof Error ? error.message : String(error);
 return NextResponse.json({ error: msg }, { status: 500 });
 }
}
