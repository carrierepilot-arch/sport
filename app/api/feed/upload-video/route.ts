import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { put } from '@vercel/blob';
import ffmpeg from 'fluent-ffmpeg';
import ffmpegPath from 'ffmpeg-static';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

export const maxDuration = 60;

const MAX_RAW_SIZE = 32 * 1024 * 1024;
const MAX_OUTPUT_SIZE = 8 * 1024 * 1024;
const MAX_DURATION_SECONDS = 10;
const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];

ffmpeg.setFfmpegPath(ffmpegPath as string);

function sanitizeName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function ensureDir(dir: string) {
  await fs.mkdir(dir, { recursive: true });
}

async function transcodeVideo(inputPath: string, outputPath: string): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        '-t',
        String(MAX_DURATION_SECONDS),
        '-vf',
        "scale='if(gt(ih,480),trunc(iw*480/ih/2)*2,trunc(iw/2)*2)':'if(gt(ih,480),480,trunc(ih/2)*2)'",
        '-c:v',
        'libx264',
        '-preset',
        'veryfast',
        '-crf',
        '30',
        '-maxrate',
        '900k',
        '-bufsize',
        '1800k',
        '-pix_fmt',
        'yuv420p',
        '-movflags',
        '+faststart',
        '-c:a',
        'aac',
        '-b:a',
        '64k',
      ])
      .format('mp4')
      .save(outputPath)
      .on('end', () => resolve())
      .on('error', (error) => reject(error));
  });
}

export async function POST(request: NextRequest) {
  const tempDir = path.join(os.tmpdir(), 'sport-feed-videos');
  await ensureDir(tempDir);

  let inputPath = '';
  let outputPath = '';

  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifie' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const formData = await request.formData();
    const file = formData.get('video') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'Video requise' }, { status: 400 });
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({ error: 'Format video non supporte (mp4, webm, mov)' }, { status: 400 });
    }
    if (file.size > MAX_RAW_SIZE) {
      return NextResponse.json({ error: 'Video source trop volumineuse (max 32 MB)' }, { status: 400 });
    }

    const safeName = sanitizeName(file.name || 'feed-video.mp4');
    const baseName = `${Date.now()}-${safeName}`;
    inputPath = path.join(tempDir, `input-${baseName}`);
    outputPath = path.join(tempDir, `output-${baseName}.mp4`);

    const arrayBuffer = await file.arrayBuffer();
    await fs.writeFile(inputPath, Buffer.from(arrayBuffer));
    await transcodeVideo(inputPath, outputPath);

    const outputBuffer = await fs.readFile(outputPath);
    if (outputBuffer.byteLength > MAX_OUTPUT_SIZE) {
      return NextResponse.json({ error: 'Video trop volumineuse apres compression (max 8 MB)' }, { status: 400 });
    }

    const storagePath = `feed-videos/${payload.userId}/${Date.now()}-${safeName.replace(/\.[^.]+$/, '')}.mp4`;
    const { url } = await put(storagePath, outputBuffer, {
      access: 'public',
      contentType: 'video/mp4',
    });

    return NextResponse.json({ videoUrl: url, durationLimit: MAX_DURATION_SECONDS, sizeLimit: MAX_OUTPUT_SIZE });
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: `Erreur upload video: ${msg}` }, { status: 500 });
  } finally {
    await Promise.all([
      inputPath ? fs.unlink(inputPath).catch(() => undefined) : Promise.resolve(),
      outputPath ? fs.unlink(outputPath).catch(() => undefined) : Promise.resolve(),
    ]);
  }
}