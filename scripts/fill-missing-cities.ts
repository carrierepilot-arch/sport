/**
 * Second pass: fills city for spots that BAN API couldn't resolve.
 * Uses Nominatim (OSM) with a small delay to respect rate limits.
 */
import { prisma } from '../lib/prisma';

const CONCURRENCY = 3; // Nominatim rate limit: 1 req/s per IP, keep low
const DELAY_MS = 1100; // ~1 req/s

async function reverseCityBAN(lat: number, lon: number): Promise<string | null> {
  const url = `https://api-adresse.data.gouv.fr/reverse/?lat=${lat}&lon=${lon}`;
  try {
    const res = await fetch(url, { headers: { Accept: 'application/json' } });
    if (!res.ok) return null;
    const data = await res.json() as { features?: Array<{ properties?: { city?: string } }> };
    return data.features?.[0]?.properties?.city?.trim() || null;
  } catch {
    return null;
  }
}

async function reverseCityNominatim(lat: number, lon: number): Promise<string | null> {
  const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=fr`;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'SportCoach/1.0 (spot-city-enrichment; contact=admin@sport-app.fr)',
        Accept: 'application/json',
      },
    });
    if (!res.ok) return null;
    const data = await res.json() as {
      address?: {
        city?: string;
        town?: string;
        village?: string;
        municipality?: string;
        suburb?: string;
        county?: string;
      };
    };
    const addr = data.address;
    if (!addr) return null;
    // Prefer city > town > village > municipality > suburb
    const city = addr.city || addr.town || addr.village || addr.municipality || addr.suburb;
    return city?.trim() || null;
  } catch {
    return null;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runSequential(
  items: Array<{ id: string; latitude: number | null; longitude: number | null }>,
) {
  let filled = 0;
  let stillMissing = 0;

  for (let i = 0; i < items.length; i++) {
    const spot = items[i];
    const lat = spot.latitude as number;
    const lon = spot.longitude as number;

    // Try BAN first (faster, FR-only)
    let city = await reverseCityBAN(lat, lon);

    // Fallback to Nominatim
    if (!city) {
      await sleep(DELAY_MS);
      city = await reverseCityNominatim(lat, lon);
    }

    if (city) {
      await prisma.spot.update({ where: { id: spot.id }, data: { city } });
      filled++;
      console.log(`[${i + 1}/${items.length}] ✓ ${city}`);
    } else {
      stillMissing++;
      console.log(`[${i + 1}/${items.length}] ✗ no city found (lat=${lat.toFixed(4)}, lon=${lon.toFixed(4)})`);
    }

    // Small delay between requests even if BAN succeeded, to be polite
    if (i < items.length - 1) await sleep(300);
  }

  return { filled, stillMissing };
}

async function main() {
  const missingCity = await prisma.spot.findMany({
    where: { status: 'approved', city: null, latitude: { not: null }, longitude: { not: null } },
    select: { id: true, latitude: true, longitude: true },
  });

  console.log(`Spots without city: ${missingCity.length}`);
  if (missingCity.length === 0) {
    console.log('Nothing to do!');
    return;
  }

  const { filled, stillMissing } = await runSequential(missingCity);

  console.log(`\nDone — filled: ${filled}, still missing: ${stillMissing}`);

  const finalStats = {
    total: await prisma.spot.count({ where: { status: 'approved' } }),
    noCity: await prisma.spot.count({ where: { status: 'approved', city: null } }),
  };
  console.log('Final stats:', finalStats);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
