/**
 * Web exercise scraper — TypeScript module (Vercel-compatible).
 * This is the production-safe version of scripts/scrape-exercises-web.mjs,
 * designed to run inline inside a Next.js API route without spawning child processes.
 */
import * as cheerio from 'cheerio';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface ScraperEvent {
  type: string;
  [key: string]: unknown;
}

export interface ScrapedExercise {
  name: string;
  slug: string;
  categories: string[];
  sourceUrls: string[];
  sourceCount: number;
  qualityScore: number;
}

export interface ScraperConfig {
  maxPagesPerSource: number;
  timeoutMs: number;
  crawlDelayMs: number;
  topic: string;
}

export interface ScraperResult {
  exercises: ScrapedExercise[];
  summary: {
    pagesVisited: number;
    rawItems: number;
    uniqueExercises: number;
    seedCount: number;
  };
  config: ScraperConfig;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

const DEFAULT_SOURCES = [
  { category: 'streetworkout', url: 'https://www.thenx.com/exercises' },
  { category: 'streetworkout', url: 'https://www.barbrothersgroningen.com/calisthenics-exercises/' },
  { category: 'streetworkout', url: 'https://www.reddit.com/r/bodyweightfitness/wiki/kb/recommended_routine/' },
  { category: 'streetworkout', url: 'https://www.setforset.com/blogs/news/calisthenics-exercises' },
  { category: 'streetworkout', url: 'https://wodprep.com/blog/calisthenics-exercises/' },
  { category: 'gym', url: 'https://www.bodybuilding.com/exercises' },
  { category: 'gym', url: 'https://www.muscleandstrength.com/exercises' },
  { category: 'gym', url: 'https://www.verywellfit.com/exercise-database-4157602' },
  { category: 'gym', url: 'https://www.menshealth.com/fitness/' },
  { category: 'gym', url: 'https://www.strengthlog.com/exercise-directory/' },
  { category: 'home', url: 'https://www.healthline.com/health/fitness/home-workout' },
  { category: 'home', url: 'https://www.nerdfitness.com/blog/beginner-body-weight-workout-burn-fat-build-muscle/' },
  { category: 'home', url: 'https://darebee.com/workouts.html' },
  { category: 'home', url: 'https://www.self.com/gallery/bodyweight-exercises-you-can-do-at-home' },
  { category: 'home', url: 'https://www.nike.com/a/bodyweight-exercises' },
  { category: 'streetworkout', url: 'https://fr.wikihow.com/faire-du-street-workout' },
  { category: 'gym', url: 'https://www.decathlon.fr/c/disc/musculation_6f8f8d92-9f09-4fb5-a0d6-4e2d68f96f0b' },
  { category: 'home', url: 'https://www.doctissimo.fr/forme/diaporamas/exercices-a-faire-a-la-maison' },
];

// ---------------------------------------------------------------------------
// Regex constants
// ---------------------------------------------------------------------------

const EXERCISE_WORD_RE = new RegExp(
  [
    'squat', 'lunge', 'push[- ]?up', 'pull[- ]?up', 'chin[- ]?up', 'dip', 'row', 'press',
    'deadlift', 'curl', 'extension', 'crunch', 'plank', 'burpee', 'mountain climber',
    'jumping jack', 'pistol squat', 'dragon flag', 'muscle[- ]?up', 'front lever',
    'back lever', 'handstand', 'planche', 'toes to bar',
    'traction', 'pompe', 'fente', 'gainage', 'abdo', 'dips', 'souleve de terre',
    'developpe', 'tirage', 'extension triceps', 'mollets', 'rowing',
    'rdl', 'good morning', 'hip thrust', 'leg raise', 'calf raise', 'face pull', 'shrug',
  ].join('|'),
  'i',
);

const STOP_WORD_RE = /^(home|fitness|gym|musculation|workout|exercises?|mouvements?|programme|program|blog|news|article|read more|voir plus)$/i;
const NOISE_RE = /(privacy|cookie|terms|policy|newsletter|login|sign up|subscribe|shop|store|cart|account|about|contact|accessibility|membership|calculator|strength standards|programs|guides|reviews|best selling|news|health conditions|my stuff|author|advertis|sponsored|promo|black friday|cyber|shipping|returns|faq)/i;
const TITLE_NOISE_RE = /^(how to|best\s|why\s|what is|what are|tips|guide|ultimate|complete|beginner|advanced|intermediate|all\s)/i;
const EXERCISE_SUFFIX_RE = /(squat|lunge|press|curl|row|deadlift|dip|pull[- ]?up|chin[- ]?up|crunch|plank|extension|raise|fly|shrug|thrust|clean|snatch)$/i;
const LINK_NOISE_RE = /(about|contact|privacy|terms|policy|newsletter|login|account|shop|store|cart|review|guide|program|calculator|news)/i;

const TOPIC_PROFILES = [
  { trigger: /(abdos|abdo|abdominal|core|gainage)/i, keywords: ['crunch', 'plank', 'sit up', 'sit-up', 'leg raise', 'hollow', 'v-up', 'v up', 'russian twist', 'mountain climber', 'toes to bar', 'hanging knee raise', 'gainage', 'abdo'] },
  { trigger: /(pectoraux|pec|chest|poitrine)/i, keywords: ['push up', 'push-up', 'bench press', 'chest press', 'fly', 'dip', 'dips', 'cable crossover', 'pompe'] },
  { trigger: /(traction|tractions|pull up|pull-up|pullup|chin up|chin-up|chinup|muscle up|muscle-up|muscleup)/i, keywords: ['pull up', 'pull-up', 'chin up', 'chin-up', 'traction', 'tractions', 'inverted row', 'australian pull up', 'australian pull-up', 'muscle up', 'muscle-up', 'lat pulldown', 'tirage'] },
  { trigger: /(dos|back|lats|grand dorsal|trap)/i, keywords: ['pull up', 'pull-up', 'chin up', 'chin-up', 'row', 'rowing', 'deadlift', 'face pull', 'lat pulldown', 'traction', 'tirage'] },
  { trigger: /(jambes|jambe|legs|quad|quadriceps|ischio|hamstring|mollet|calf)/i, keywords: ['squat', 'lunge', 'deadlift', 'leg press', 'leg extension', 'leg curl', 'calf raise', 'split squat', 'fente', 'mollets'] },
  { trigger: /(epaules|epaule|shoulder|deltoid)/i, keywords: ['shoulder press', 'overhead press', 'lateral raise', 'front raise', 'reverse fly', 'handstand push up', 'handstand push-up', 'arnold press'] },
  { trigger: /(biceps)/i, keywords: ['curl', 'chin up', 'chin-up', 'hammer curl', 'preacher curl'] },
  { trigger: /(triceps)/i, keywords: ['dip', 'dips', 'tricep extension', 'triceps extension', 'close grip bench press', 'diamond push up', 'diamond push-up'] },
  { trigger: /(fessier|fessiers|glute|glutes)/i, keywords: ['hip thrust', 'glute bridge', 'romanian deadlift', 'rdl', 'lunge', 'split squat', 'kickback'] },
  { trigger: /(cardio|endurance|conditioning|hiit)/i, keywords: ['burpee', 'mountain climber', 'jumping jack', 'high knees', 'skater jump', 'jump squat', 'rope'] },
  { trigger: /(douleur|tendon|tendons|tendinite|injury|blessure|rehab|reeducation|readaptation|physio|knee pain|elbow pain|shoulder pain|achilles|rotulien|epaule douloureuse)/i, keywords: ['isometric hold', 'eccentric squat', 'eccentric calf raise', 'calf raise', 'wall sit', 'reverse nordic', 'split squat', 'step up', 'glute bridge', 'clamshell', 'band external rotation', 'row', 'mobility drill', 'stretch', 'tendon rehab', 'tendinopathy rehab'] },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeTopic(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9\s-]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function inferCategory(topic: string): string {
  const n = normalizeTopic(topic);
  if (!n) return 'custom';
  if (/(street|calisthenics|poids du corps|bodyweight|traction|pull up|muscle up|planche|front lever)/i.test(n)) return 'streetworkout';
  if (/(maison|home|sans materiel|bodyweight workout|a domicile)/i.test(n)) return 'home';
  if (/(gym|musculation|bodybuilding|halteres|barbell|dumbbell|machine)/i.test(n)) return 'gym';
  return 'custom';
}

function buildTopicSpecificSources(topic: string, category: string) {
  const normalized = normalizeTopic(topic);

  if (/(traction|tractions|pull up|pull-up|pullup|chin up|chin-up|chinup|muscle up|muscle-up|muscleup)/i.test(normalized)) {
    return [
      { category, url: 'https://www.setforset.com/blogs/news/pull-up-variations' },
      { category, url: 'https://barbend.com/pull-up-variations/' },
      { category, url: 'https://www.boxrox.com/best-pull-up-variations/' },
      { category, url: 'https://www.nerdfitness.com/blog/do-a-pull-up/' },
      { category, url: 'https://www.reddit.com/r/bodyweightfitness/wiki/exercises/pullup/' },
    ];
  }

  if (/(douleur|tendon|tendons|tendinite|injury|blessure|rehab|reeducation|readaptation|physio|achilles|rotulien|epaule|shoulder pain|knee pain|elbow pain)/i.test(normalized)) {
    return [
      { category: 'home', url: 'https://www.physio-pedia.com/Tendinopathy_Rehabilitation' },
      { category: 'home', url: 'https://www.verywellfit.com/eccentric-exercises-2696612' },
      { category: 'home', url: 'https://www.nerdfitness.com/blog/bodyweight-exercises/' },
      { category: 'home', url: 'https://www.healthline.com/health/fitness/rehab-exercises' },
      { category: 'home', url: 'https://www.webmd.com/fitness-exercise/ss/slideshow-stretches-flexibility' },
    ];
  }

  return [];
}

function buildTopicSources(topic: string) {
  const normalized = normalizeTopic(topic);
  if (!normalized) return DEFAULT_SOURCES;
  const category = inferCategory(normalized);
  const enc = encodeURIComponent(`${topic} exercices`);
  const encEn = encodeURIComponent(`${topic} exercises`);
  const topicSpecific = buildTopicSpecificSources(topic, category);
  return [
    ...topicSpecific,
    { category, url: `https://html.duckduckgo.com/html/?q=${enc}` },
    { category, url: `https://html.duckduckgo.com/html/?q=${encEn}` },
    { category, url: `https://www.google.com/search?q=${enc}` },
    { category, url: `https://www.google.com/search?q=${encEn}` },
    { category, url: `https://www.youtube.com/results?search_query=${enc}` },
    ...DEFAULT_SOURCES.filter((s) => category === 'custom' || s.category === category),
  ];
}

function getTopicKeywords(topic: string): string[] {
  const normalized = normalizeTopic(topic);
  if (!normalized) return [];
  const profileKeywords = TOPIC_PROFILES.filter((p) => p.trigger.test(normalized)).flatMap((p) => p.keywords);
  const rawTokens = normalized.split(/\s+/).filter((t) => t.length >= 3);
  return Array.from(new Set([...profileKeywords, ...rawTokens]));
}

function matchesTopic(text: string, topicKeywords: string[]): boolean {
  if (!topicKeywords.length) return true;
  const norm = normalizeTopic(text);
  return topicKeywords.some((k) => norm.includes(normalizeTopic(k)));
}

function makeSlug(value: string): string {
  return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

function resolveUrl(baseUrl: string, href: string): string | null {
  try { return new URL(href, baseUrl).toString(); } catch { return null; }
}

function shouldKeepLink(link: string, origin: string): boolean {
  try {
    const u = new URL(link);
    if (u.origin !== origin) return false;
    if (!/^https?:$/.test(u.protocol)) return false;
    const p = u.pathname.toLowerCase();
    if (/(\.jpg|\.jpeg|\.png|\.gif|\.webp|\.svg|\.pdf|\.zip|\.mp4|\.mp3)$/i.test(p)) return false;
    if (/(exercise|workout|training|fitness|calisthenics|street|musculation|mouvement|exercice|routine|program|programme)/i.test(p)) return true;
    return p.split('/').filter(Boolean).length <= 3;
  } catch { return false; }
}

function cleanName(text: string): string {
  let v = (text || '').replace(/\s+/g, ' ').trim();
  v = v.replace(/^[-•#\d).\s]+/, '').replace(/[|:][^|:]{25,}$/g, '').replace(/^["'""'']+|["'""'']+$/g, '').replace(/\((video|guide|tutorial|tips?)\)/gi, '').replace(/\s{2,}/g, ' ').trim();
  v = v.replace(/^best\s+/i, '').replace(/^how to\s+/i, '').replace(/^what is\s+/i, '').replace(/^what are\s+/i, '').trim();
  if (!v || v.length < 3 || v.length > 60) return '';
  if (STOP_WORD_RE.test(v)) return '';
  if (NOISE_RE.test(v)) return '';
  if (/^[^a-zA-Z\u00C0-\u017F]+$/.test(v)) return '';
  if (/^\d+$/.test(v)) return '';
  if (TITLE_NOISE_RE.test(v)) return '';
  return v;
}

function qualityScore(text: string): number {
  let score = 0;
  const words = text.split(/\s+/).filter(Boolean);
  if (EXERCISE_WORD_RE.test(text)) score += 4;
  if (EXERCISE_SUFFIX_RE.test(text)) score += 3;
  if (words.length >= 1 && words.length <= 4) score += 2;
  if (words.length > 5) score -= 3;
  if (/\b(best|guide|tips|program|workout|exercise|exercises|article|news|review)\b/i.test(text)) score -= 2;
  if (NOISE_RE.test(text)) score -= 6;
  if (TITLE_NOISE_RE.test(text)) score -= 3;
  return score;
}

function looksLikeExerciseName(text: string): boolean {
  if (!text) return false;
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length > 5) return false;
  if (NOISE_RE.test(text)) return false;
  return qualityScore(text) >= 4;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ---------------------------------------------------------------------------
// Core scraping functions
// ---------------------------------------------------------------------------

async function fetchHtml(url: string, timeoutMs: number): Promise<string | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; SportExerciseBot/1.0; +https://sport-alpha-lake.vercel.app)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) return null;
    const ct = res.headers.get('content-type') || '';
    if (!ct.includes('text/html')) return null;
    return await res.text();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractFromPage(html: string, pageUrl: string, topicKeywords: string[]): Array<{ name: string; slug: string; sourceUrl: string; qualityScore: number }> {
  const $ = cheerio.load(html);
  const found = new Map<string, { name: string; qualityScore: number }>();

  const selectors = ['h1', 'h2', 'h3', 'h4', 'li', 'a[href*="exercise"]', 'a[href*="exercice"]', 'a[href*="workout"]', '[class*="exercise"]', '[class*="workout"]', '[data-title]'];
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const raw = $(el).text() || $(el).attr('title') || $(el).attr('data-title') || '';
      const text = cleanName(raw);
      if (!text || !looksLikeExerciseName(text)) return;
      if (!matchesTopic(text, topicKeywords)) return;
      const score = qualityScore(text);
      const prev = found.get(text);
      if (!prev || score > prev.qualityScore) found.set(text, { name: text, qualityScore: score });
    });
  }

  $('a[href]').each((_, el) => {
    const href = ($(el).attr('href') || '').toLowerCase();
    if (!href || LINK_NOISE_RE.test(href)) return;
    if (!/(exercise|exercises|workout|calisthenics|street|fitness)/i.test(href)) return;
    const text = cleanName($(el).text());
    if (!text || !looksLikeExerciseName(text)) return;
    if (!matchesTopic(text, topicKeywords)) return;
    const boosted = qualityScore(text) + 2;
    const prev = found.get(text);
    if (!prev || boosted > prev.qualityScore) found.set(text, { name: text, qualityScore: boosted });
  });

  return Array.from(found.values()).map((entry) => ({ name: entry.name, slug: makeSlug(entry.name), sourceUrl: pageUrl, qualityScore: entry.qualityScore }));
}

async function crawlSource(
  seedUrl: string,
  category: string,
  config: ScraperConfig,
  sourceIndex: number,
  sourceTotal: number,
  topicKeywords: string[],
  onEvent: (e: ScraperEvent) => void,
) {
  let origin: string;
  try { origin = new URL(seedUrl).origin; }
  catch { onEvent({ type: 'source_done', index: sourceIndex, pagesVisited: 0, items: 0 }); return { seedUrl, category, pagesVisited: 0, items: [] }; }

  const queue = [seedUrl];
  const visited = new Set<string>();
  const items: Array<{ name: string; slug: string; sourceUrl: string; qualityScore: number; category: string }> = [];

  onEvent({ type: 'source_start', index: sourceIndex, total: sourceTotal, url: seedUrl, category });

  while (queue.length > 0 && visited.size < config.maxPagesPerSource) {
    const url = queue.shift();
    if (!url || visited.has(url)) continue;
    visited.add(url);

    const html = await fetchHtml(url, config.timeoutMs);
    if (!html) { await sleep(config.crawlDelayMs); continue; }

    const extracted = extractFromPage(html, url, topicKeywords);
    for (const row of extracted) items.push({ ...row, category });

    onEvent({ type: 'page_done', sourceIndex, pageUrl: url, pagesVisited: visited.size, pageExtracted: extracted.length, totalItems: items.length });

    const $ = cheerio.load(html);
    $('a[href]').each((_, a) => {
      const href = $(a).attr('href');
      if (!href) return;
      const abs = resolveUrl(url, href);
      if (!abs || !shouldKeepLink(abs, origin) || visited.has(abs) || queue.includes(abs)) return;
      queue.push(abs);
    });

    await sleep(config.crawlDelayMs);
  }

  onEvent({ type: 'source_done', index: sourceIndex, pagesVisited: visited.size, items: items.length });
  return { seedUrl, category, pagesVisited: visited.size, items };
}

function dedupeRows(rows: Array<{ name: string; slug: string; sourceUrl: string; qualityScore: number; category: string }>): ScrapedExercise[] {
  const map = new Map<string, { name: string; slug: string; categories: Set<string>; sourceUrls: Set<string>; qualityScore: number }>();

  for (const row of rows) {
    const key = makeSlug(row.name);
    if (!key) continue;
    if (!map.has(key)) {
      map.set(key, { name: row.name, slug: key, categories: new Set([row.category]), sourceUrls: new Set([row.sourceUrl]), qualityScore: row.qualityScore || 0 });
      continue;
    }
    const cur = map.get(key)!;
    cur.categories.add(row.category);
    cur.sourceUrls.add(row.sourceUrl);
    cur.qualityScore = Math.max(cur.qualityScore, row.qualityScore || 0);
    if (row.name.length < cur.name.length && row.name.length >= 4) cur.name = row.name;
  }

  return Array.from(map.values())
    .map((v) => ({ name: v.name, slug: v.slug, categories: Array.from(v.categories).sort(), sourceUrls: Array.from(v.sourceUrls).slice(0, 20), sourceCount: v.sourceUrls.size, qualityScore: v.qualityScore }))
    .filter((r) => r.qualityScore >= 4)
    .sort((a, b) => a.name.localeCompare(b.name));
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function runScraper(config: ScraperConfig, onEvent: (event: ScraperEvent) => void): Promise<ScraperResult> {
  const sources = buildTopicSources(config.topic);
  const topicKeywords = getTopicKeywords(config.topic);

  onEvent({ type: 'start', totalSources: sources.length, topic: config.topic || null, maxPages: config.maxPagesPerSource });

  const bySource: Array<{ seedUrl: string; category: string; pagesVisited: number; items: Array<{ name: string; slug: string; sourceUrl: string; qualityScore: number; category: string }> }> = [];

  for (let i = 0; i < sources.length; i++) {
    const source = sources[i];
    const result = await crawlSource(source.url, source.category, config, i + 1, sources.length, topicKeywords, onEvent);
    bySource.push(result);
  }

  const allRows = bySource.flatMap((s) => s.items);
  const deduped = dedupeRows(allRows);

  const summary = {
    pagesVisited: bySource.reduce((acc, s) => acc + s.pagesVisited, 0),
    rawItems: allRows.length,
    uniqueExercises: deduped.length,
    seedCount: sources.length,
  };

  onEvent({ type: 'done', ...summary });

  return { exercises: deduped, summary, config };
}
