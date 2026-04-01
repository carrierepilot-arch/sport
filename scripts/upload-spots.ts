/**
 * Upload scraped spots from france-spots.json to the deployed app via the bulk API.
 *
 * Usage: npx tsx scripts/upload-spots.ts
 *
 * Requires: scripts/france-spots.json (output of scrape-france-spots.ts)
 * Env: APP_URL (defaults to https://sport-levelflow.vercel.app)
 *       ADMIN_TOKEN (JWT token of an admin user)
 */

import fs from 'fs';
import path from 'path';

const APP_URL = process.env.APP_URL || 'https://sport-levelflow.vercel.app';
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || '';
const BULK_SECRET = process.env.BULK_IMPORT_SECRET || '';
const BATCH_SIZE = 150; // spots per request

function getAuthHeader(): string {
  if (BULK_SECRET) return `BulkSecret ${BULK_SECRET}`;
  if (ADMIN_TOKEN) return `Bearer ${ADMIN_TOKEN}`;
  return '';
}

async function main() {
  if (!ADMIN_TOKEN && !BULK_SECRET) {
    console.error('Set ADMIN_TOKEN or BULK_IMPORT_SECRET env variable');
    process.exit(1);
  }

  const scriptDir = path.dirname(new URL(import.meta.url).pathname.replace(/^\/([A-Z]:)/, '$1'));
  const filePath = path.join(scriptDir, 'france-spots.json');
  if (!fs.existsSync(filePath)) {
    console.error(`File not found: ${filePath}\nRun scrape-france-spots.ts first.`);
    process.exit(1);
  }

  const spots: Array<{ name: string; city: string | null; latitude: number; longitude: number }> = JSON.parse(
    fs.readFileSync(filePath, 'utf-8'),
  );

  console.log(`Loaded ${spots.length} spots from france-spots.json`);
  console.log(`Uploading in batches of ${BATCH_SIZE} to ${APP_URL}/api/admin/spots/bulk\n`);

  // First check current count
  try {
    const res = await fetch(`${APP_URL}/api/admin/spots/bulk`, {
      headers: { Authorization: getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`Current DB: ${data.approved} approved spots (${data.withCoords} with coords)\n`);
    }
  } catch {
    console.warn('Could not fetch current count, continuing...\n');
  }

  let totalCreated = 0;
  let totalSkipped = 0;

  for (let i = 0; i < spots.length; i += BATCH_SIZE) {
    const batch = spots.slice(i, i + BATCH_SIZE);
    const batchNum = Math.floor(i / BATCH_SIZE) + 1;
    const totalBatches = Math.ceil(spots.length / BATCH_SIZE);

    try {
      const res = await fetch(`${APP_URL}/api/admin/spots/bulk`, {
        method: 'POST',
        headers: {
          Authorization: getAuthHeader(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ spots: batch }),
      });

      if (!res.ok) {
        const text = await res.text();
        console.error(`  Batch ${batchNum}/${totalBatches}: HTTP ${res.status} — ${text}`);
        continue;
      }

      const data = await res.json();
      totalCreated += data.created;
      totalSkipped += data.duplicatesSkipped;
      console.log(`  Batch ${batchNum}/${totalBatches}: +${data.created} created, ${data.duplicatesSkipped} dupes skipped`);
    } catch (err) {
      console.error(`  Batch ${batchNum}/${totalBatches}: Network error`, err);
    }

    // Small delay to avoid overwhelming the server
    if (i + BATCH_SIZE < spots.length) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log(`\n=== DONE ===`);
  console.log(`Total created: ${totalCreated}`);
  console.log(`Total duplicates skipped: ${totalSkipped}`);

  // Final count
  try {
    const res = await fetch(`${APP_URL}/api/admin/spots/bulk`, {
      headers: { Authorization: getAuthHeader() },
    });
    if (res.ok) {
      const data = await res.json();
      console.log(`\nFinal DB count: ${data.approved} approved spots (${data.withCoords} with coords)`);
    }
  } catch {
    // silent
  }
}

main().catch(console.error);
