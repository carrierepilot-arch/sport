import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchExercisesByCategory, fetchExercisesByEquipment, WGER_CATEGORIES } from '@/lib/wger';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { logApiCall } from '@/lib/api-logger';

// Extend Vercel function timeout to 120 s (Pro plan) for long AI calls
export const maxDuration = 120;

type ProviderCounters = {
 wgerCalls: number;
 exerciseDbCalls: number;
 ncbiCalls: number;
};

type ProgrammeShape = {
 jours?: Array<{
 exercices?: Array<{ nom?: string; series?: number }>;
 }>;
 semaines?: Array<{
 jours?: Array<{
 exercices?: Array<{ nom?: string; series?: number }>;
 }>;
 }>;
};

type StructuredExercise = {
 nom: string;
 series: number;
 reps: string;
 repos: string;
 conseil?: string;
};

type StructuredDay = {
 jour: string;
 focus: string;
 exercices: StructuredExercise[];
};

type StructuredProgramme = {
 jours: StructuredDay[];
 semaines?: Array<{ semaine: number; description?: string; jours: StructuredDay[] }>;
 conseils_generaux?: string;
 progression_4_semaines?: string;
};

function cleanJson(raw: string): string {
 return raw.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
}

function toText(value: unknown, fallback: string): string {
 const s = typeof value === 'string' ? value.trim() : '';
 return s || fallback;
}

function normalizeExercise(value: unknown): StructuredExercise | null {
 if (!value || typeof value !== 'object') return null;
 const item = value as Record<string, unknown>;
 const nom = toText(item.nom, 'Exercice');
 const series = Math.max(1, Math.min(8, Number(item.series) || 3));
 // Accept both "reps" and "repetitions" keys from the AI
 const reps = toText(item.reps ?? item.repetitions, '10');
 const repos = toText(item.repos, '90s');
 const conseil = typeof item.conseil === 'string' && item.conseil.trim() ? item.conseil.trim() : undefined;
 return { nom, series, reps, repos, ...(conseil ? { conseil } : {}) };
}

function normalizeDay(value: unknown, index: number): StructuredDay | null {
 if (!value || typeof value !== 'object') return null;
 const item = value as Record<string, unknown>;
 const exercices = Array.isArray(item.exercices)
 ? item.exercices.map(normalizeExercise).filter((x): x is StructuredExercise => !!x)
 : [];
 if (!exercices.length) return null;
 return {
 jour: toText(item.jour, `Jour ${index + 1}`),
 focus: toText(item.focus, 'Entrainement'),
 exercices,
 };
}

function parseStructuredProgramme(programmeRaw: string): StructuredProgramme | null {
 const cleaned = cleanJson(programmeRaw);
 const candidates: string[] = [cleaned];
 const firstBrace = cleaned.indexOf('{');
 const lastBrace = cleaned.lastIndexOf('}');
 if (firstBrace >= 0 && lastBrace > firstBrace) {
 candidates.push(cleaned.slice(firstBrace, lastBrace + 1));
 }

 for (const candidate of candidates) {
 try {
 const parsed = JSON.parse(candidate) as Record<string, unknown>;

 // jours can be an array [{jour, exercices}, ...] OR a dict {"Lundi": {exercices}, ...}
 let directDays: StructuredDay[];
 if (Array.isArray(parsed.jours)) {
 directDays = parsed.jours.map(normalizeDay).filter((x): x is StructuredDay => !!x);
 } else if (parsed.jours && typeof parsed.jours === 'object') {
 // convert dict {"Lundi": {exercices:[...], focus:...}} to array
 directDays = Object.entries(parsed.jours as Record<string, unknown>)
 .map(([dayName, dayData], i) => {
 if (!dayData || typeof dayData !== 'object') return null;
 return normalizeDay({ ...(dayData as Record<string, unknown>), jour: dayName }, i);
 })
 .filter((x): x is StructuredDay => !!x);
 } else {
 directDays = [];
 }

 const weeks = Array.isArray(parsed.semaines)
 ? parsed.semaines
 .map((weekValue, weekIndex) => {
 if (!weekValue || typeof weekValue !== 'object') return null;
 const weekObj = weekValue as Record<string, unknown>;
 let days: StructuredDay[];
 if (Array.isArray(weekObj.jours)) {
 days = weekObj.jours.map(normalizeDay).filter((x): x is StructuredDay => !!x);
 } else if (weekObj.jours && typeof weekObj.jours === 'object') {
 days = Object.entries(weekObj.jours as Record<string, unknown>)
 .map(([dayName, dayData], i) => {
 if (!dayData || typeof dayData !== 'object') return null;
 return normalizeDay({ ...(dayData as Record<string, unknown>), jour: dayName }, i);
 })
 .filter((x): x is StructuredDay => !!x);
 } else {
 days = [];
 }
 if (!days.length) return null;
 return {
 semaine: Math.max(1, Number(weekObj.semaine) || weekIndex + 1),
 description: typeof weekObj.description === 'string' ? weekObj.description : undefined,
 jours: days,
 };
 })
 .filter((x) => x !== null)
 : [];

 const normalizedDays = directDays.length ? directDays : weeks.flatMap((w) => w.jours.map((d) => ({ ...d, jour: `S${w.semaine} - ${d.jour}` })));
 if (!normalizedDays.length) continue;

 return {
 jours: normalizedDays,
 ...(weeks.length ? { semaines: weeks } : {}),
 ...(typeof parsed.conseils_generaux === 'string' ? { conseils_generaux: parsed.conseils_generaux } : {}),
 ...(typeof parsed.progression_4_semaines === 'string' ? { progression_4_semaines: parsed.progression_4_semaines } : {}),
 };
 } catch {
 // try next candidate
 }
 }

 return null;
}

function extractExerciseNames(programmeRaw: string): string[] {
 try {
 const parsed = JSON.parse(cleanJson(programmeRaw)) as ProgrammeShape;
 const names: string[] = [];

 const pushFromExercises = (exercises: Array<{ nom?: string; series?: number }> = []) => {
 for (const exercise of exercises) {
 const base = (exercise.nom || '').trim();
 if (!base) continue;
 const series = Math.max(1, Math.min(Number(exercise.series) || 1, 8));
 for (let i = 0; i < series; i++) names.push(base);
 }
 };

 for (const day of parsed.jours || []) pushFromExercises(day.exercices || []);
 for (const week of parsed.semaines || []) {
 for (const day of week.jours || []) pushFromExercises(day.exercices || []);
 }

 return names;
 } catch {
 return [];
 }
}

async function logApiUsage(userId: string, provider: 'wger' | 'exercisedb' | 'ncbi', callCount: number, details: Record<string, unknown> = {}) {
 if (callCount <= 0) return;
 const action = provider === 'wger' ? 'wger_api_call' : provider === 'exercisedb' ? 'exercisedb_api_call' : 'ncbi_api_call';
 await prisma.activityLog.create({
 data: {
 userId,
 action,
 details: JSON.stringify({ callCount, ...details }),
 },
 });
}

// ExerciseDB (RapidAPI) fetch
async function fetchExerciseDBByBodyPart(muscle: string, counters: ProviderCounters, limit = 10): Promise<string[]> {
 const key = process.env.RAPIDAPI_KEY;
 if (!key) return [];

 const muscleMap: Record<string, string> = {
 Pectoraux: 'chest', Dos: 'back', Epaules: 'shoulders',
 Biceps: 'biceps', Triceps: 'triceps', Abdominaux: 'abs', Jambes: 'quads',
 };
 const slug = muscleMap[muscle] || 'chest';
 const endpoint = `https://exercisedb.p.rapidapi.com/exercises/bodyPart/${slug}?limit=${limit}&offset=0`;

 try {
 counters.exerciseDbCalls += 1;
 const res = await fetch(endpoint, {
 headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
 });
 await logApiCall({
 apiName: 'exerciseDB',
 endpoint,
 requestPayload: { muscle, slug, limit },
 responseStatus: res.status,
 });
 if (!res.ok) return [];
 const data = await res.json() as Array<{ name?: string }>;
 return data.map((e) => e.name || '').filter(Boolean);
 } catch {
 await logApiCall({
 apiName: 'exerciseDB',
 endpoint,
 requestPayload: { muscle, slug, limit },
 responseStatus: 500,
 });
 return [];
 }
}

async function probeExerciseDBByName(name: string, counters: ProviderCounters): Promise<void> {
 const key = process.env.RAPIDAPI_KEY;
 if (!key) return;
 const endpoint = `https://exercisedb.p.rapidapi.com/exercises/name/${encodeURIComponent(name)}?limit=1&offset=0`;
 try {
 counters.exerciseDbCalls += 1;
 const res = await fetch(endpoint, {
 headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
 next: { revalidate: 3600 },
 });
 await logApiCall({ apiName: 'exerciseDB', endpoint, requestPayload: { name }, responseStatus: res.status });
 } catch {
 await logApiCall({ apiName: 'exerciseDB', endpoint, requestPayload: { name }, responseStatus: 500 });
 // non-blocking probe
 }
}

async function probeWgerByName(name: string, counters: ProviderCounters): Promise<void> {
 const endpoint = `https://wger.de/api/v2/exerciseinfo/?format=json&language=2&limit=1&term=${encodeURIComponent(name)}`;
 try {
 counters.wgerCalls += 1;
 const res = await fetch(endpoint, {
 headers: {
 Authorization: `Token ${process.env.WGER_API_TOKEN}`,
 },
 next: { revalidate: 3600 },
 });
 await logApiCall({ apiName: 'wger', endpoint, requestPayload: { name }, responseStatus: res.status });
 } catch {
 await logApiCall({ apiName: 'wger', endpoint, requestPayload: { name }, responseStatus: 500 });
 // non-blocking probe
 }
}

async function fetchNCBISnippets(query: string, counters: ProviderCounters): Promise<string[]> {
 const q = encodeURIComponent(`${query} calisthenics OR resistance training`);
 const searchUrl = `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esearch.fcgi?db=pubmed&retmode=json&retmax=3&term=${q}`;

 try {
 counters.ncbiCalls += 1;
 const searchRes = await fetch(searchUrl, { next: { revalidate: 3600 } });
 await logApiCall({ apiName: 'ncbi', endpoint: searchUrl, requestPayload: { query }, responseStatus: searchRes.status });
 if (!searchRes.ok) return [];

 const searchData = await searchRes.json() as { esearchresult?: { idlist?: string[] } };
 const ids = searchData.esearchresult?.idlist ?? [];
 if (!ids.length) return [];

 counters.ncbiCalls += 1;
 const summaryRes = await fetch(
 `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi?db=pubmed&retmode=json&id=${ids.join(',')}`,
 { next: { revalidate: 3600 } },
 );
 await logApiCall({
 apiName: 'ncbi',
 endpoint: `https://eutils.ncbi.nlm.nih.gov/entrez/eutils/esummary.fcgi`,
 requestPayload: { ids },
 responseStatus: summaryRes.status,
 });
 if (!summaryRes.ok) return [];

 const summaryData = await summaryRes.json() as { result?: Record<string, { title?: string }> };
 return ids
 .map((id) => summaryData.result?.[id]?.title)
 .filter((title): title is string => !!title)
 .slice(0, 3);
 } catch {
 await logApiCall({ apiName: 'ncbi', endpoint: searchUrl, requestPayload: { query }, responseStatus: 500 });
 return [];
 }
}

export async function POST(req: NextRequest) {
 try {
 const body = await req.json();
 const { objectif, frequence, joursSelectes, lieu, equipements, equipConfig, figuresSelectees, niveauxFigures, musclesCibles, tempsSeance, dureeProgramme, pointsDouleur, musclesRetard, lieuParJour } = body;
 const token = req.headers.get('authorization')?.replace('Bearer ', '');
 const payload = token ? verifyToken(token) : null;
 const requesterUserId = payload?.userId || null;
 const userProfile = requesterUserId
 ? await prisma.user.findUnique({
 where: { id: requesterUserId },
 select: { level: true, levelTestData: true, physicalData: true },
 })
 : null;

 const providerCounters: ProviderCounters = { wgerCalls: 0, exerciseDbCalls: 0, ncbiCalls: 0 };

 // 1) Base exercises from Wger
 let wgerExercises: string[] = [];
 try {
 const fetchPromises: Promise<{ name: string }[]>[] = [];

 if (lieu === 'Street workout') {
 fetchPromises.push(fetchExercisesByEquipment(7, 20, requesterUserId || undefined));
 } else if (lieu === 'Maison') {
 fetchPromises.push(fetchExercisesByEquipment(7, 15, requesterUserId || undefined));
 } else if (lieu === 'Salle de sport') {
 fetchPromises.push(fetchExercisesByEquipment(1, 10, requesterUserId || undefined));
 fetchPromises.push(fetchExercisesByEquipment(3, 10, requesterUserId || undefined));
 }

 if (musclesCibles?.length) {
 for (const muscle of musclesCibles.slice(0, 3)) {
 if (WGER_CATEGORIES[muscle]) {
 fetchPromises.push(fetchExercisesByCategory(WGER_CATEGORIES[muscle], 8, requesterUserId || undefined));
 }
 }
 }

 if (fetchPromises.length > 0) {
 providerCounters.wgerCalls += fetchPromises.length;
 const results = await Promise.all(fetchPromises);
 wgerExercises = [...new Set(results.flat().map((ex) => ex.name).filter(Boolean))].slice(0, 25);
 }
 } catch {
 // non-blocking
 }

 // 2) ExerciseDB (RapidAPI)
 let exerciseDBNames: string[] = [];
 try {
 const muscle = musclesCibles?.[0] || 'Pectoraux';
 exerciseDBNames = await fetchExerciseDBByBodyPart(muscle, providerCounters, 10);
 } catch {
 // non-blocking
 }

 // 3) NCBI context (scientific hints)
 const ncbiTitles = await fetchNCBISnippets(`${objectif || ''} ${musclesCibles?.join(' ') || ''}`.trim(), providerCounters);

 // Prompt context building
 const joursStr = joursSelectes?.length ? joursSelectes.join(', ') : 'non definis';
 const equipStr = equipements?.length
 ? equipements.map((e: string) => {
 const conf = equipConfig?.[e];
 const parts = [e];
 if (conf?.maxKg) parts.push(`max ${conf.maxKg} kg`);
 if (conf?.progression) parts.push(`progression: ${conf.progression}`);
 if (conf?.detail) parts.push(conf.detail);
 return parts.join(' (') + (parts.length > 1 ? ')' : '');
 }).join(', ')
 : 'aucun';

 const figuresStr = figuresSelectees?.length
 ? figuresSelectees.map((f: string) => `${f} (niveau: ${niveauxFigures?.[f] ?? 'non defini'})`).join(', ')
 : 'aucune';

 const musclesStr = musclesCibles?.length ? musclesCibles.join(', ') : 'aucun en particulier';

 let lieuConstraint = '';
 if (lieu === 'Street workout') {
 lieuConstraint = `\n\nCONTRAINTE ABSOLUE : Le lieu est "Street workout" (parc, barres exterieures).
Tu ne dois utiliser AUCUN equipement de salle de sport : pas d'halteres, pas de kettlebells, pas de machines, pas de banc de musculation, pas de cables, pas de barre guidee.
Seuls les equipements autorises sont : barre de traction, barres paralleles (dips), le sol et le poids du corps.
${equipements?.length ? `L'utilisateur possede aussi : ${equipStr}. Tu peux les integrer dans les exercices (ex: tractions lestees, dips lestes).` : ''}
Tous les exercices doivent etre realisables en exterieur avec ces equipements uniquement.`;
 } else if (lieu === 'Maison') {
 lieuConstraint = `\n\nCONTRAINTE : Le lieu est "Maison". Utilise uniquement des exercices au poids du corps ou avec le matériel déclaré par l'utilisateur.
${equipements?.length ? `L'utilisateur dispose de : ${equipStr}. Intègre ces équipements dans les exercices proposés pour varier les stimulations.` : 'Pas de matériel, utilise uniquement le poids du corps, une chaise, un mur.'}
Pas de machines de salle, pas de barres olympiques, pas de banc de musculation (sauf si déclaré).`;
 } else if (lieu === 'Salle de sport') {
 lieuConstraint = `\n\nCONTRAINTE : Le lieu est "Salle de sport". Tu peux utiliser tous les équipements disponibles en salle.
${equipements?.length ? `L'utilisateur possède aussi du matériel personnel : ${equipStr}. Intègre-le si pertinent.` : ''}`;
 }

 const allExercises = [...new Set([...wgerExercises, ...exerciseDBNames])];
 const exoContext = allExercises.length
 ? `\n\nExercices disponibles dans notre base de donnees (Wger + ExerciseDB) :\n${allExercises.map((e) => `- ${e}`).join('\n')}\n\nUtilise de preference ces exercices dans le programme, en filtrant ceux qui correspondent au lieu.`
 : '';

 const scienceContext = ncbiTitles.length
 ? `\n\nContexte scientifique (NCBI/PubMed, titres recents) :\n${ncbiTitles.map((t) => `- ${t}`).join('\n')}\nUtilise ces elements pour fiabiliser les conseils de progression, echauffement et recuperation.`
 : '';

 const tempsMinutes: Record<string, number> = { '30min': 30, '1h': 60, '1h30': 90, '2h': 120 };
 const sessionMinutes = tempsMinutes[tempsSeance] || 60;
 const avgMinPerExercice = 6;
 const isLongProgramme = dureeProgramme === '2_mois' || dureeProgramme === '3_mois';
 const targetExercices = isLongProgramme
 ? Math.max(4, Math.min(6, Math.round(sessionMinutes / 10)))
 : Math.max(4, Math.round(sessionMinutes / avgMinPerExercice));

 const dureeConstraint = `\n\nCONTRAINTE DUREE DE SEANCE (TRES IMPORTANT - RESPECTER ABSOLUMENT) :
La seance DOIT durer EXACTEMENT ${sessionMinutes} minutes.
Pour atteindre cette duree, chaque jour DOIT contenir entre ${targetExercices - 1} et ${targetExercices + 2} exercices.`;

 const dureeMap: Record<string, number> = {
 '1_semaine': 1, '2_semaines': 2, '1_mois': 4, '2_mois': 8, '3_mois': 12,
 };
 const nbSemaines = dureeMap[dureeProgramme] || 1;
 const isMultiWeek = nbSemaines > 1;

 const progressionConstraint = isMultiWeek
 ? `\n\nCONTRAINTE PROGRESSION (TRES IMPORTANT) :\nLe programme dure ${nbSemaines} semaines. Progression obligatoire semaine par semaine.`
 : '';

 const levelTestData = userProfile?.levelTestData && typeof userProfile.levelTestData === 'object'
 ? userProfile.levelTestData as Record<string, unknown>
 : null;
 const latestPhysicalEntry = Array.isArray(userProfile?.physicalData) && userProfile.physicalData.length > 0
 ? userProfile.physicalData[userProfile.physicalData.length - 1] as Record<string, unknown>
 : null;
 const enduranceResults = Array.isArray(levelTestData?.resultats) ? levelTestData.resultats as unknown[] : [];
 const manualForceData = levelTestData?.manualForce && typeof levelTestData.manualForce === 'object'
 ? levelTestData.manualForce as Record<string, unknown>
 : null;
 const profileContext = `\n\nPROFIL ATHLETE :
- Niveau enregistre : ${userProfile?.level || 'intermediaire'}${typeof levelTestData?.manualLevel === 'string' ? `\n- Niveau declare au test : ${String(levelTestData.manualLevel)}` : ''}${typeof levelTestData?.detectedLevel === 'string' ? `\n- Niveau detecte au test : ${String(levelTestData.detectedLevel)}` : ''}${enduranceResults.length ? `\n- Resultats test endurance : ${enduranceResults.map((value, index) => `${index + 1}:${String(value)}`).join(', ')}` : ''}${manualForceData ? `\n- Force lestee declaree : ${Object.entries(manualForceData).map(([key, value]) => `${key}=${String(value)}`).join(', ')}` : ''}${latestPhysicalEntry ? `\n- Dernieres donnees physiques : ${Object.entries(latestPhysicalEntry).filter(([, value]) => value !== null && value !== '').map(([key, value]) => `${key}=${String(value)}`).join(', ')}` : ''}
Utilise IMPERATIVEMENT ces donnees pour calibrer la difficulte, le volume, la progression et les variantes.`;
 const multiWeekCompactness = isLongProgramme
 ? `\n\nCONTRAINTE DE SORTIE LONGUE DUREE :
Programme long (${nbSemaines} semaines). Reste compact et exploitable :
- 4 a 6 exercices maximum par jour
- descriptions courtes
- progression visible semaine par semaine
- pas de texte superflu hors JSON`
 : '';

 const singleWeekSchema = `{"jours":[{"jour":"Lundi","focus":"Dos","exercices":[{"nom":"Tractions","series":3,"reps":"8-10","repos":"90s","conseil":"..."}]}],"conseils_generaux":"...","progression_4_semaines":"..."}`;
 const multiWeekSchema = `{"semaines":[{"semaine":1,"description":"...","jours":[{"jour":"Lundi","focus":"Dos","exercices":[{"nom":"Tractions","series":3,"reps":"8-10","repos":"90s"}]}]}],"conseils_generaux":"...","progression_4_semaines":"..."}`;

 const formatInstruction = isMultiWeek
 ? `\nIMPORTANT: Reponds UNIQUEMENT en JSON valide (pas de texte avant ni apres, pas de commentaires). Structure OBLIGATOIRE avec "semaines" TABLEAU de ${nbSemaines} objets, chaque objet ayant "semaine" (nombre), "description" (string), "jours" TABLEAU d'objets avec "jour","focus","exercices". Chaque exercice doit avoir "nom","series" (nombre), "reps" (string ex: "8-10"), "repos" (string ex: "90s"), "conseil" (string optionnel). Schema: ${multiWeekSchema}`
 : `\nIMPORTANT: Reponds UNIQUEMENT en JSON valide (pas de texte avant ni apres, pas de commentaires). Structure OBLIGATOIRE: "jours" DOIT etre un TABLEAU (array) d'objets, jamais un objet/dictionnaire. Chaque objet jour doit avoir "jour" (nom du jour), "focus" (string), "exercices" (TABLEAU). Chaque exercice doit avoir "nom","series" (nombre), "reps" (string ex: "8-10"), "repos" (string ex: "90s"), "conseil" (string optionnel). Schema: ${singleWeekSchema}`;

 const prompt = `Tu es un coach de street workout et fitness expert. Cree un programme d'entrainement personnalise et detaille en francais.${lieuConstraint}${dureeConstraint}${progressionConstraint}${multiWeekCompactness}${profileContext}

Informations de l'utilisateur :
- Objectif principal : ${objectif || 'general'}
- Frequence : ${frequence} seances par semaine
- Jours d'entrainement : ${joursStr}
- Lieu : ${lieu || 'non precise'}
- Equipement personnel : ${equipStr}
- Figures statiques travaillees : ${figuresStr}
- Muscles a developper en priorite : ${musclesStr}
- Duree souhaitee de la seance : ${tempsSeance || 'non precise'}
- Duree du programme : ${nbSemaines} semaine(s)${pointsDouleur?.length ? `\n- Points de douleur / blessures : ${pointsDouleur.join(', ')}` : ''}${musclesRetard?.length ? `\n- Muscles en retard a prioriser : ${musclesRetard.join(', ')}` : ''}${lieuParJour && Object.keys(lieuParJour).length > 0 ? `\n- Lieu par jour : ${Object.entries(lieuParJour).map(([j, l]) => `${j} -> ${l}`).join(', ')}` : ''}${exoContext}${scienceContext}
${formatInstruction}`;

 const nbJours = joursSelectes?.length || frequence || 3;
 const tokensPerExercice = 80;
 const totalExercices = targetExercices * nbJours;
 const sessionTokens = Math.max(3000, totalExercices * tokensPerExercice + 1200);
 const maxTokens = isMultiWeek
 ? Math.min(16000, 2500 + nbSemaines * nbJours * targetExercices * 60)
 : Math.min(10000, sessionTokens);

 const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
 const completion = await openai.chat.completions.create({
 model: 'gpt-4o-mini',
 messages: [{ role: 'user', content: prompt }],
 max_tokens: maxTokens,
 temperature: 0.7,
 response_format: { type: 'json_object' },
 });

 const programme = completion.choices[0]?.message?.content ?? '';
 const structuredProgramme = parseStructuredProgramme(programme);
 if (!structuredProgramme) {
 return NextResponse.json({ error: 'La reponse IA n\'est pas dans un format programme valide. Veuillez relancer la generation.' }, { status: 502 });
 }

 // Per-exercise API probes for tracking — fire-and-forget, do NOT await.
 const exerciseNames = extractExerciseNames(programme).slice(0, 20);
 Promise.all(exerciseNames.map(async (name) => {
 await Promise.all([
 probeWgerByName(name, providerCounters),
 probeExerciseDBByName(name, providerCounters),
 ]);
 })).catch(() => { /* non-blocking */ });

 const usage = completion.usage;
 const promptTokens = usage?.prompt_tokens ?? 0;
 const completionTokens = usage?.completion_tokens ?? 0;
 const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
 const estimatedCost = totalTokens * 0.00000015;

 await logApiCall({
 apiName: 'openai',
 endpoint: 'chat.completions.create',
 requestPayload: { model: 'gpt-4o-mini', maxTokens },
 responseStatus: 200,
 tokensUsed: totalTokens,
 costEstimate: parseFloat(estimatedCost.toFixed(6)),
 userId: requesterUserId,
 });

 try {
 if (payload) {
 await prisma.activityLog.create({
 data: {
 userId: payload.userId,
 action: 'ai_api_call',
 details: JSON.stringify({
 model: 'gpt-4o-mini',
 promptTokens,
 completionTokens,
 totalTokens,
 estimatedCost: parseFloat(estimatedCost.toFixed(6)),
 maxTokensRequested: maxTokens,
 }),
 },
 });

 await Promise.all([
 logApiUsage(payload.userId, 'wger', providerCounters.wgerCalls, { source: 'generate-workout', trackedExercises: exerciseNames.length }),
 logApiUsage(payload.userId, 'exercisedb', providerCounters.exerciseDbCalls, { source: 'generate-workout', trackedExercises: exerciseNames.length }),
 logApiUsage(payload.userId, 'ncbi', providerCounters.ncbiCalls, { source: 'generate-workout' }),
 ]);
 }
 } catch {
 // do not fail request when logging fails
 }

 return NextResponse.json({
 programme: JSON.stringify(structuredProgramme),
 programmeData: structuredProgramme,
 providerUsage: providerCounters,
 });
 } catch (error) {
 const msg = error instanceof Error ? error.message : String(error);
 console.error('OpenAI error:', msg);

 if (msg.includes('API key') || msg.includes('Incorrect API key') || msg.includes('invalid_api_key')) {
 return NextResponse.json({ error: 'Cle OpenAI invalide ou manquante. Ajoutez OPENAI_API_KEY dans .env.local puis redemarrez le serveur.' }, { status: 401 });
 }
 if (msg.includes('insufficient_quota')) {
 return NextResponse.json({ error: 'Quota OpenAI depasse. Verifiez votre compte sur platform.openai.com.' }, { status: 429 });
 }
 return NextResponse.json({ error: 'Erreur OpenAI : ' + msg }, { status: 500 });
 }
}
