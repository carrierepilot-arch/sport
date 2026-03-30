import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import { createClient } from '@supabase/supabase-js';

ffmpeg.setFfmpegPath(ffmpegPath as string);

const SOURCE_DIR = process.env.EXERCISE_MEDIA_SOURCE_DIR || 'C:/Users/Admin/Desktop/MuscleWiki_GIFs';
const TMP_DIR = path.join(os.tmpdir(), 'sport-exercise-media');
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_EXERCISE_BUCKET || process.env.SUPABASE_EXERCISE_BUCKET || 'exercise-media';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error('Supabase non configure. Ajoutez SUPABASE_URL/NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SERVICE_ROLE_KEY.');
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function normalizeBaseName(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

async function buildAnimatedWebp(frameA: string, frameB: string, outputPath: string): Promise<void> {
  await fs.mkdir(path.dirname(outputPath), { recursive: true });
  await new Promise<void>((resolve, reject) => {
    ffmpeg()
      .input(frameA)
      .inputOptions(['-loop 1', '-t 0.6'])
      .input(frameB)
      .inputOptions(['-loop 1', '-t 0.6'])
      .complexFilter('[0:v][1:v]concat=n=2:v=1:a=0,scale=480:-1:flags=lanczos')
      .outputOptions([
        '-an',
        '-loop',
        '0',
        '-r',
        '8',
        '-quality',
        '70',
        '-compression_level',
        '6',
      ])
      .format('webp')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
}

async function main() {
  const entries = await fs.readdir(SOURCE_DIR);
  const grouped = new Map<string, { one?: string; two?: string }>();

  for (const entry of entries) {
    if (!entry.endsWith('.png')) continue;
    const match = entry.match(/^(.*)-(1|2)\.png$/i);
    if (!match) continue;
    const [, rawBaseName, frameIndex] = match;
    const bucket = grouped.get(rawBaseName) ?? {};
    if (frameIndex === '1') bucket.one = path.join(SOURCE_DIR, entry);
    if (frameIndex === '2') bucket.two = path.join(SOURCE_DIR, entry);
    grouped.set(rawBaseName, bucket);
  }

  let uploaded = 0;
  for (const [rawBaseName, frames] of grouped) {
    if (!frames.one || !frames.two) continue;
    const outputName = `${normalizeBaseName(rawBaseName)}.webp`;
    const outputPath = path.join(TMP_DIR, outputName);
    await buildAnimatedWebp(frames.one, frames.two, outputPath);
    const fileBuffer = await fs.readFile(outputPath);
    const { error } = await supabase.storage.from(SUPABASE_BUCKET).upload(outputName, fileBuffer, {
      upsert: true,
      contentType: 'image/webp',
      cacheControl: '31536000',
    });
    if (error) throw error;
    uploaded += 1;
  }

  console.log(`Uploaded ${uploaded} exercise animations to Supabase bucket ${SUPABASE_BUCKET}.`);
}

void main();