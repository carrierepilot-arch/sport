import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';
import { fetchExercisesByCategory, fetchExercisesByEquipment, WGER_CATEGORIES, WGER_EQUIPMENT } from '@/lib/wger';
import { verifyToken } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

// ExerciseDB (RapidAPI) fetch
async function fetchExerciseDB(muscle: string, limit = 10): Promise<string[]> {
  const key = process.env.RAPIDAPI_KEY;
  if (!key) return [];
  const muscleMap: Record<string, string> = {
    Pectoraux: 'chest', Dos: 'back', Epaules: 'shoulders',
    Biceps: 'biceps', Triceps: 'triceps', Abdominaux: 'abs', Jambes: 'quads',
  };
  const slug = muscleMap[muscle] || 'chest';
  try {
    const res = await fetch(`https://exercisedb.p.rapidapi.com/exercises/bodyPart/${slug}?limit=${limit}&offset=0`, {
      headers: { 'x-rapidapi-key': key, 'x-rapidapi-host': 'exercisedb.p.rapidapi.com' },
    });
    if (!res.ok) return [];
    const data = await res.json();
    return (data as { name: string }[]).map((e) => e.name).filter(Boolean);
  } catch { return []; }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { objectif, frequence, joursSelectes, lieu, equipements, equipConfig, figuresSelectees, niveauxFigures, musclesCibles, tempsSeance, dureeProgramme } = body;

    // ── 1. Fetch exercises from Wger (base de donnees) ──
    let wgerExercises: string[] = [];
    try {
      const fetchPromises: Promise<{ name: string }[]>[] = [];

      if (lieu === 'Street workout') {
        fetchPromises.push(fetchExercisesByEquipment(7, 20));
      } else if (lieu === 'Maison') {
        fetchPromises.push(fetchExercisesByEquipment(7, 15));
      } else if (lieu === 'Salle de sport') {
        fetchPromises.push(fetchExercisesByEquipment(1, 10));
        fetchPromises.push(fetchExercisesByEquipment(3, 10));
      }

      if (musclesCibles?.length) {
        for (const muscle of musclesCibles.slice(0, 3)) {
          if (WGER_CATEGORIES[muscle]) {
            fetchPromises.push(fetchExercisesByCategory(WGER_CATEGORIES[muscle], 8));
          }
        }
      }

      if (fetchPromises.length > 0) {
        const results = await Promise.all(fetchPromises);
        wgerExercises = [...new Set(results.flat().map((ex) => ex.name).filter(Boolean))].slice(0, 25);
      }
    } catch { /* non-blocking */ }

    // ── 2. Fetch from ExerciseDB (RapidAPI) ──
    let exerciseDBNames: string[] = [];
    try {
      const muscle = musclesCibles?.[0] || 'Pectoraux';
      exerciseDBNames = await fetchExerciseDB(muscle, 10);
    } catch { /* non-blocking */ }

    // ── 3. Build prompt with strict constraints ──
    const joursStr  = joursSelectes?.length ? joursSelectes.join(', ') : 'non definis';
    const equipStr  = equipements?.length
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

    // Street workout constraint
    let lieuConstraint = '';
    if (lieu === 'Street workout') {
      lieuConstraint = `\n\nCONTRAINTE ABSOLUE : Le lieu est "Street workout" (parc, barres exterieures).
Tu ne dois utiliser AUCUN equipement de salle de sport : pas d'halteres, pas de kettlebells, pas de machines, pas de banc de musculation, pas de cables, pas de barre guidee.
Seuls les equipements autorises sont : barre de traction, barres paralleles (dips), le sol et le poids du corps.
${equipements?.length ? `L'utilisateur possede aussi : ${equipStr}. Tu peux les integrer dans les exercices (ex: tractions lestees, dips lestes).` : ''}
Tous les exercices doivent etre realisables en exterieur avec ces equipements uniquement.`;
    } else if (lieu === 'Maison') {
      lieuConstraint = `\n\nCONTRAINTE : Le lieu est "Maison". Utilise uniquement des exercices au poids du corps ou avec le matériel déclaré par l'utilisateur.
${equipements?.length ? `L'utilisateur dispose de : ${equipStr}. Intègre ces équipements dans les exercices proposés pour varier les stimulations (ex: tractions avec élastiques, squats avec haltères, etc).` : 'Pas de matériel, utilise uniquement le poids du corps, une chaise, un mur.'}
Pas de machines de salle, pas de barres olympiques, pas de banc de musculation (sauf si déclaré).`;
    } else if (lieu === 'Salle de sport') {
      lieuConstraint = `\n\nCONTRAINTE : Le lieu est "Salle de sport". Tu peux utiliser tous les équipements disponibles en salle (machines, haltères, barres, cables, etc).
${equipements?.length ? `L'utilisateur possède aussi du matériel personnel : ${equipStr}. Intègre-le si pertinent.` : ''}`;
    }

    const allExercises = [...new Set([...wgerExercises, ...exerciseDBNames])];
    const exoContext = allExercises.length
      ? `\n\nExercices disponibles dans notre base de donnees (Wger + ExerciseDB) :\n${allExercises.map((e) => `- ${e}`).join('\n')}\n\nUtilise de preference ces exercices dans le programme, en filtrant ceux qui correspondent au lieu.`
      : '';

    // ── Duration constraint: calculate time budget per session ──
    const tempsMinutes: Record<string, number> = { '30min': 30, '1h': 60, '1h30': 90, '2h': 120 };
    const sessionMinutes = tempsMinutes[tempsSeance] || 60;
    // Calculate approximate exercise count: each exercise takes ~(series * (reps_time + repos_time)) 
    // Average: 4 series * (30s execution + 90s rest) = ~8min per exercise
    const avgMinPerExercice = 8;
    const targetExercices = Math.max(3, Math.round(sessionMinutes / avgMinPerExercice));

    const dureeConstraint = `\n\nCONTRAINTE DUREE DE SEANCE (TRES IMPORTANT) :
La seance doit durer EXACTEMENT environ ${sessionMinutes} minutes.
Pour cela, chaque jour doit contenir entre ${targetExercices - 1} et ${targetExercices + 1} exercices.
Calcul : chaque exercice prend en moyenne (series x (temps d'execution ~30s + repos)) donc ajuste le nombre d'exercices, de series et de repos pour atteindre ${sessionMinutes} minutes au total.
- Pour 30min : 3-4 exercices, 3 series, repos courts (60s)
- Pour 1h : 6-8 exercices, 3-4 series, repos 60-90s
- Pour 1h30 : 9-12 exercices, 4 series, repos 90s
- Pour 2h : 12-15 exercices, 4-5 series, repos 90-120s
NE GENERE PAS un nombre d'exercices trop faible. La seance doit etre COMPLETE et remplir toute la duree demandee.`;

    // ── Multi-week / progressive overload constraint ──
    const dureeMap: Record<string, number> = {
      '1_semaine': 1, '2_semaines': 2, '1_mois': 4, '2_mois': 8, '3_mois': 12,
    };
    const nbSemaines = dureeMap[dureeProgramme] || 1;
    const isMultiWeek = nbSemaines > 1;

    let progressionConstraint = '';
    let formatInstruction = '';

    if (isMultiWeek) {
      progressionConstraint = `\n\nCONTRAINTE PROGRESSION (TRES IMPORTANT) :
Le programme dure ${nbSemaines} semaines. Tu dois generer un programme pour CHAQUE semaine avec une progression d'intensite.
Regles de progression semaine par semaine :
- Semaine 1 : volume et intensite de base (adaptation)
- Semaines suivantes : augmenter progressivement (+1-2 reps, +1 serie, -10s de repos, ou +charge si equipe)
- Toutes les 3-4 semaines : semaine de decharge (reduire le volume de 30-40%)
- La derniere semaine doit etre plus intense que la premiere
Exemples de progression :
  - Pompes : S1 = 3x8, S2 = 3x10, S3 = 4x10, S4 = 3x8 (decharge)
  - Tractions : S1 = 3x5, S2 = 3x6, S3 = 3x7, S4 = 4x6
Pour les programmes de 2+ mois, varie aussi les exercices toutes les 4 semaines pour eviter la stagnation.`;

      formatInstruction = `
IMPORTANT - Format de reponse structure MULTI-SEMAINES :
Reponds EXACTEMENT dans ce format JSON :
{
  "semaines": [
    {
      "semaine": 1,
      "description": "Semaine d'adaptation - volume modere",
      "jours": [
        {
          "jour": "Lundi",
          "focus": "Haut du corps - Poussee",
          "exercices": [
            { "nom": "Pompes", "series": 3, "reps": "8", "repos": "90s", "conseil": "Controle la descente" }
          ]
        }
      ]
    },
    {
      "semaine": 2,
      "description": "Augmentation du volume",
      "jours": [...]
    }
  ],
  "conseils_generaux": "2-3 phrases de conseils generaux.",
  "progression_4_semaines": "Resume de la logique de progression."
}

Tu DOIS generer exactement ${nbSemaines} objets dans "semaines", chacun avec ${joursSelectes?.length || frequence} jours d'entrainement.
Reponds UNIQUEMENT avec le JSON valide, sans texte avant ou apres.`;
    } else {
      formatInstruction = `
IMPORTANT - Format de reponse structure :
Pour chaque jour d'entrainement, reponds EXACTEMENT dans ce format JSON :
{
  "jours": [
    {
      "jour": "Nom du jour",
      "focus": "Theme de la seance (ex: Haut du corps, Tirage, etc.)",
      "exercices": [
        { "nom": "Nom de l'exercice", "series": 4, "reps": "10", "repos": "90s", "conseil": "Petit conseil optionnel" }
      ]
    }
  ],
  "conseils_generaux": "2-3 phrases de conseils generaux et progression.",
  "progression_4_semaines": "Description courte de la progression sur 4 semaines."
}

Reponds UNIQUEMENT avec le JSON valide, sans texte avant ou apres.`;
    }

    const prompt = `Tu es un coach de street workout et fitness expert. Cree un programme d'entrainement personnalise et detaille en francais.${lieuConstraint}${dureeConstraint}${progressionConstraint}

Informations de l'utilisateur :
- Objectif principal : ${objectif || 'general'}
- Frequence : ${frequence} seances par semaine
- Jours d'entrainement : ${joursStr}
- Lieu : ${lieu || 'non precise'}
- Equipement personnel : ${equipStr}
- Figures statiques travaillees : ${figuresStr}
- Muscles a developper en priorite : ${musclesStr}
- Duree souhaitee de la seance : ${tempsSeance || 'non precise'}
- Duree du programme : ${nbSemaines} semaine(s)${exoContext}
${formatInstruction}`;

    // Adjust max_tokens based on program length and session duration
    const nbJours = joursSelectes?.length || frequence || 3;
    const tokensPerExercice = 80; // avg tokens per exercise object in JSON
    const totalExercices = targetExercices * nbJours;
    const sessionTokens = Math.max(2000, totalExercices * tokensPerExercice + 800);
    const maxTokens = isMultiWeek ? Math.min(16000, 2000 + nbSemaines * nbJours * targetExercices * tokensPerExercice) : Math.min(8000, sessionTokens);

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: maxTokens,
      temperature: 0.7,
    });

    const programme = completion.choices[0]?.message?.content ?? '';

    // ── Track real API usage ──
    const usage = completion.usage;
    const promptTokens = usage?.prompt_tokens ?? 0;
    const completionTokens = usage?.completion_tokens ?? 0;
    const totalTokens = usage?.total_tokens ?? (promptTokens + completionTokens);
    const estimatedCost = totalTokens * 0.00000015; // gpt-4o-mini pricing ~$0.15/1M tokens

    // Log activity if user is authenticated
    try {
      const token = req.headers.get('authorization')?.replace('Bearer ', '');
      if (token) {
        const payload = verifyToken(token);
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
        }
      }
    } catch { /* don't fail the request if logging fails */ }

    return NextResponse.json({ programme });
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
