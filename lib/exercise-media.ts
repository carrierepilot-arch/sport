export type ExerciseMediaCatalogEntry = {
  label: string;
  frames?: string[];
  supabaseUrl?: string | null;
  instructionFr?: string;
  aliases?: string[];
};

export function normalizeExerciseName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function toExerciseMediaSlug(value: string): string {
  return normalizeExerciseName(value).replace(/ /g, '-');
}

export const EXERCISE_MEDIA_CATALOG: Record<string, ExerciseMediaCatalogEntry> = {
  'push ups': {
    label: 'Pompes',
    frames: ['/exercise-media/frames/push-ups-1.png', '/exercise-media/frames/push-ups-2.png'],
    instructionFr: 'Gaine le tronc, poitrine ouverte et descends de facon controlee avant de repousser fort.',
    aliases: ['pompes', 'push up'],
  },
  'pull ups': {
    label: 'Tractions',
    frames: ['/exercise-media/frames/pull-ups-1.png', '/exercise-media/frames/pull-ups-2.png'],
    instructionFr: 'Tire les coudes vers les hanches et garde le buste gainé sur toute la repetition.',
    aliases: ['tractions', 'pull up'],
  },
  'chin ups': {
    label: 'Tractions supination',
    frames: ['/exercise-media/frames/chin-ups-1.png', '/exercise-media/frames/chin-ups-2.png'],
    instructionFr: 'Paumes vers toi, menton au-dessus de la barre et controle la descente.',
    aliases: ['chin up', 'tractions supination'],
  },
  'body row': {
    label: 'Rowing au poids du corps',
    frames: ['/exercise-media/frames/body-row-1.png', '/exercise-media/frames/body-row-2.png'],
    instructionFr: 'Garde une ligne solide des talons aux epaules et amene la poitrine vers la barre.',
    aliases: ['rowing inverse', 'australian pull up'],
  },
  'chest dips': {
    label: 'Dips poitrine',
    frames: ['/exercise-media/frames/chest-dips-1.png', '/exercise-media/frames/chest-dips-2.png'],
    instructionFr: 'Penche legerement le buste vers l avant pour engager la poitrine sans casser le gainage.',
    aliases: ['dips poitrine'],
  },
  'tricep dips': {
    label: 'Dips triceps',
    frames: ['/exercise-media/frames/tricep-dips-1.png', '/exercise-media/frames/tricep-dips-2.png'],
    instructionFr: 'Coudes serres, amplitude propre et verrouillage controle en haut du mouvement.',
    aliases: ['dips triceps', 'bench dips'],
  },
  'close triceps pushup': {
    label: 'Pompes triceps',
    frames: ['/exercise-media/frames/close-triceps-pushup-1.png', '/exercise-media/frames/close-triceps-pushup-2.png'],
    instructionFr: 'Mains proches, coudes le long du corps et buste gainé pour cibler les triceps.',
    aliases: ['pompes triceps', 'diamond push ups', 'diamond push up'],
  },
  'crunches': {
    label: 'Crunchs',
    frames: ['/exercise-media/frames/crunches-1.png', '/exercise-media/frames/crunches-2.png'],
    instructionFr: 'Enroule la colonne sans tirer sur la nuque et souffle en montant.',
    aliases: ['crunch', 'abdos crunch'],
  },
  'flutter kicks': {
    label: 'Battements de jambes',
    frames: ['/exercise-media/frames/flutter-kicks-1.png', '/exercise-media/frames/flutter-kicks-2.png'],
    instructionFr: 'Bas du dos colle au sol et petits battements reguliers sans casser le gainage.',
    aliases: ['flutter kick'],
  },
  'side plank': {
    label: 'Planche laterale',
    frames: ['/exercise-media/frames/side-plank-1.png', '/exercise-media/frames/side-plank-2.png'],
    instructionFr: 'Epaule empilee, bassin haut et ligne droite de la tete aux chevilles.',
    aliases: ['planche laterale'],
  },
  'walking lunges': {
    label: 'Fentes marchees',
    frames: ['/exercise-media/frames/walking-lunges-1.png', '/exercise-media/frames/walking-lunges-2.png'],
    instructionFr: 'Grand pas, genou stable et pousse dans le pied avant pour revenir en extension.',
    aliases: ['fentes marchees', 'walking lunge'],
  },
  'squats using dumbbells': {
    label: 'Squats halteres',
    frames: ['/exercise-media/frames/squats-using-dumbbells-1.png', '/exercise-media/frames/squats-using-dumbbells-2.png'],
    instructionFr: 'Poitrine haute, hanches en arriere et pousse uniforme dans tout le pied.',
    aliases: ['squats', 'squat', 'air squats', 'air squat'],
  },
};

const aliasIndex = new Map<string, string>();
for (const [key, entry] of Object.entries(EXERCISE_MEDIA_CATALOG)) {
  aliasIndex.set(normalizeExerciseName(key), key);
  for (const alias of entry.aliases ?? []) {
    aliasIndex.set(normalizeExerciseName(alias), key);
  }
}

export function findCatalogExerciseMedia(name: string): ExerciseMediaCatalogEntry | null {
  const normalized = normalizeExerciseName(name);
  const key = aliasIndex.get(normalized);
  return key ? EXERCISE_MEDIA_CATALOG[key] : null;
}

export function listMediaUrlsForPrefetch(media: { gifUrl?: string | null; animationFrames?: string[] | null }): string[] {
  return [media.gifUrl, ...(media.animationFrames ?? [])].filter((value): value is string => typeof value === 'string' && value.length > 0);
}