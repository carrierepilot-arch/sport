import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';

const ALLOWED_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
const MAX_SIZE = 200 * 1024 * 1024; // 200 MB

export async function POST(request: NextRequest): Promise<NextResponse> {
  const authHeader = request.headers.get('authorization') ?? '';
  const token = authHeader.replace('Bearer ', '');

  try {
    const body = (await request.json()) as HandleUploadBody;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (_pathname) => {
        if (!token) throw new Error('Non authentifie');
        const payload = verifyToken(token);
        if (!payload) throw new Error('Token invalide');

        return {
          allowedContentTypes: ALLOWED_TYPES,
          maximumSizeInBytes: MAX_SIZE,
          tokenPayload: JSON.stringify({ userId: payload.userId }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // Nothing to write to DB here — the URL is returned to the client
        // who embeds it in the post content. Logging only.
        const { userId } = JSON.parse(tokenPayload ?? '{}');
        console.log(`Feed video uploaded by ${userId}: ${blob.url}`);
      },
    });

    return NextResponse.json(jsonResponse);
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
