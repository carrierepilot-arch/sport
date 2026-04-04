import { prisma } from '@/lib/prisma';

export type SectionStatus = 'active' | 'disabled' | 'standby' | 'stopped' | 'hidden';

export type SectionDefinition = {
  key: string;
  label: string;
  paths: string[];
};

export type SectionControl = SectionDefinition & {
  status: SectionStatus;
  maintenanceMessage: string | null;
  updatedAt: string;
};

export type RateLimitConfig = {
  enabled: boolean;
  maxRequests: number;
  windowMs: number;
  mutatingOnly: boolean;
};

export type AdminControlConfig = {
  version: number;
  sections: Record<string, SectionControl>;
  rateLimit: RateLimitConfig;
  feedLocked: boolean;
  messagingLocked: boolean;
  updatedAt: string;
};

// Short-lived in-memory cache (valid for one serverless invocation only).
let inMemoryConfig: AdminControlConfig | null = null;

const SECTION_DEFINITIONS: SectionDefinition[] = [
  { key: 'dashboard.home', label: 'Accueil', paths: ['/dashboard'] },
  { key: 'dashboard.programmes', label: 'Programmes', paths: ['/dashboard/entrainement'] },
  { key: 'dashboard.progression', label: 'Progression', paths: ['/dashboard/analyse'] },
  { key: 'dashboard.profil', label: 'Profil', paths: ['/dashboard/profil'] },
  { key: 'dashboard.reseau', label: 'Reseau', paths: ['/dashboard/reseau'] },
  { key: 'dashboard.boite-reception', label: 'Boite de reception', paths: ['/dashboard/boite-reception'] },
  { key: 'dashboard.carte', label: 'Carte', paths: ['/dashboard/carte'] },
  { key: 'dashboard.classement', label: 'Classement', paths: ['/dashboard/classement'] },
  { key: 'dashboard.mini-jeux', label: 'Mini jeux', paths: ['/dashboard/mini-jeux'] },
  { key: 'dashboard.idees', label: 'Idees', paths: ['/dashboard/idees'] },
  { key: 'dashboard.admin', label: 'Admin', paths: ['/dashboard/admin'] },
];

const DEFAULT_RATE_LIMIT: RateLimitConfig = {
  enabled: true,
  maxRequests: 3,
  windowMs: 1000,
  mutatingOnly: true,
};

function defaultMessageForStatus(status: SectionStatus): string | null {
  if (status === 'active' || status === 'hidden') return null;
  if (status === 'standby') return 'Rubrique temporairement en stand-by. Merci de reessayer dans quelques instants.';
  if (status === 'stopped') return 'Rubrique arretee temporairement pour proteger la plateforme.';
  return 'Rubrique en maintenance. Merci de revenir plus tard.';
}

function createDefaultConfig(): AdminControlConfig {
  const now = new Date().toISOString();
  const sections: Record<string, SectionControl> = {};
  for (const section of SECTION_DEFINITIONS) {
    sections[section.key] = {
      ...section,
      status: 'active',
      maintenanceMessage: null,
      updatedAt: now,
    };
  }
  return {
    version: 1,
    sections,
    rateLimit: DEFAULT_RATE_LIMIT,
    feedLocked: false,
    messagingLocked: false,
    updatedAt: now,
  };
}

function sanitizeSections(raw: unknown): Record<string, SectionControl> {
  const source = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const sections: Record<string, SectionControl> = {};

  for (const def of SECTION_DEFINITIONS) {
    const entry = source[def.key] as Partial<SectionControl> | undefined;
    const status = entry?.status;
    const safeStatus: SectionStatus =
      status === 'active' || status === 'disabled' || status === 'standby' || status === 'stopped' || status === 'hidden'
        ? status
        : 'active';

    sections[def.key] = {
      ...def,
      status: safeStatus,
      maintenanceMessage:
        typeof entry?.maintenanceMessage === 'string'
          ? entry.maintenanceMessage.slice(0, 260)
          : defaultMessageForStatus(safeStatus),
      updatedAt: typeof entry?.updatedAt === 'string' ? entry.updatedAt : now,
    };
  }
  return sections;
}

function sanitizeRateLimit(raw: unknown): RateLimitConfig {
  const rate = (raw && typeof raw === 'object' ? raw : {}) as Partial<RateLimitConfig>;
  return {
    enabled: typeof rate.enabled === 'boolean' ? rate.enabled : DEFAULT_RATE_LIMIT.enabled,
    maxRequests: Math.max(1, Math.min(50, Number(rate.maxRequests ?? DEFAULT_RATE_LIMIT.maxRequests))),
    windowMs: Math.max(250, Math.min(60_000, Number(rate.windowMs ?? DEFAULT_RATE_LIMIT.windowMs))),
    mutatingOnly: typeof rate.mutatingOnly === 'boolean' ? rate.mutatingOnly : DEFAULT_RATE_LIMIT.mutatingOnly,
  };
}

function rowToConfig(row: {
  feedLocked: boolean;
  messagingLocked: boolean;
  sectionsJson: string;
  rateLimitJson: string;
  updatedAt: Date;
}): AdminControlConfig {
  let rawSections: unknown = {};
  let rawRate: unknown = {};
  try { rawSections = JSON.parse(row.sectionsJson); } catch { /* use default */ }
  try { rawRate = JSON.parse(row.rateLimitJson); } catch { /* use default */ }

  return {
    version: 1,
    sections: sanitizeSections(rawSections),
    rateLimit: sanitizeRateLimit(rawRate),
    feedLocked: row.feedLocked,
    messagingLocked: row.messagingLocked,
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getAdminControlConfig(): Promise<AdminControlConfig> {
  if (inMemoryConfig) return inMemoryConfig;

  try {
    const row = await prisma.adminConfig.findUnique({ where: { id: 'singleton' } });
    if (row) {
      inMemoryConfig = rowToConfig(row);
      return inMemoryConfig;
    }
  } catch (err) {
    console.error('[AdminConfig] DB read error:', err);
  }

  const def = createDefaultConfig();
  inMemoryConfig = def;
  try {
    await saveAdminControlConfig(def);
  } catch {
    // Ignore — in-memory fallback will be served.
  }
  return def;
}

export async function saveAdminControlConfig(config: AdminControlConfig): Promise<void> {
  inMemoryConfig = config;

  await prisma.adminConfig.upsert({
    where: { id: 'singleton' },
    update: {
      feedLocked: config.feedLocked,
      messagingLocked: config.messagingLocked,
      sectionsJson: JSON.stringify(config.sections),
      rateLimitJson: JSON.stringify(config.rateLimit),
    },
    create: {
      id: 'singleton',
      feedLocked: config.feedLocked,
      messagingLocked: config.messagingLocked,
      sectionsJson: JSON.stringify(config.sections),
      rateLimitJson: JSON.stringify(config.rateLimit),
    },
  });
}

export async function patchSectionControl(
  key: string,
  update: Partial<Pick<SectionControl, 'status' | 'maintenanceMessage'>>,
): Promise<AdminControlConfig> {
  const current = await getAdminControlConfig();
  if (!current.sections[key]) return current;

  const prev = current.sections[key];
  const nextStatus = update.status ?? prev.status;
  const nextMessage =
    typeof update.maintenanceMessage === 'string'
      ? update.maintenanceMessage.slice(0, 260)
      : prev.maintenanceMessage ?? defaultMessageForStatus(nextStatus);

  current.sections[key] = {
    ...prev,
    status: nextStatus,
    maintenanceMessage: nextMessage,
    updatedAt: new Date().toISOString(),
  };
  current.updatedAt = new Date().toISOString();
  await saveAdminControlConfig(current);
  return current;
}

export async function patchRateLimitConfig(update: Partial<RateLimitConfig>): Promise<AdminControlConfig> {
  const current = await getAdminControlConfig();
  current.rateLimit = {
    enabled: typeof update.enabled === 'boolean' ? update.enabled : current.rateLimit.enabled,
    maxRequests: Math.max(1, Math.min(50, Number(update.maxRequests ?? current.rateLimit.maxRequests))),
    windowMs: Math.max(250, Math.min(60_000, Number(update.windowMs ?? current.rateLimit.windowMs))),
    mutatingOnly: typeof update.mutatingOnly === 'boolean' ? update.mutatingOnly : current.rateLimit.mutatingOnly,
  };
  current.updatedAt = new Date().toISOString();
  await saveAdminControlConfig(current);
  return current;
}

export async function patchFeedLock(locked: boolean): Promise<AdminControlConfig> {
  const current = await getAdminControlConfig();
  current.feedLocked = locked;
  current.updatedAt = new Date().toISOString();
  await saveAdminControlConfig(current);
  return current;
}

export async function patchMessagingLock(locked: boolean): Promise<AdminControlConfig> {
  const current = await getAdminControlConfig();
  current.messagingLocked = locked;
  current.updatedAt = new Date().toISOString();
  await saveAdminControlConfig(current);
  return current;
}

export function getSectionDefinitions(): SectionDefinition[] {
  return SECTION_DEFINITIONS;
}

export async function getSectionByPath(pathname: string): Promise<SectionControl | null> {
  const config = await getAdminControlConfig();
  const normalized = pathname === '/dashboard/' ? '/dashboard' : pathname;

  const ranked = Object.values(config.sections)
    .flatMap((section) => section.paths.map((p) => ({ section, path: p })))
    .sort((a, b) => b.path.length - a.path.length);

  const found = ranked.find(({ path: p }) => normalized === p || normalized.startsWith(`${p}/`));
  return found?.section ?? null;
}
