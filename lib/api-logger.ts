import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';

type ApiName = 'exerciseDB' | 'wger' | 'openai' | 'ncbi' | 'supabase' | 'vercel-blob';

type LogApiCallParams = {
  apiName: ApiName;
  endpoint: string;
  requestPayload?: unknown;
  responseStatus?: number;
  tokensUsed?: number;
  costEstimate?: number;
  userId?: string | null;
};

export async function logApiCall(params: LogApiCallParams): Promise<void> {
  try {
    await prisma.apiLog.create({
      data: {
        apiName: params.apiName,
        endpoint: params.endpoint,
        requestPayload: params.requestPayload === undefined ? undefined : (params.requestPayload as Prisma.InputJsonValue),
        responseStatus: params.responseStatus ?? null,
        tokensUsed: params.tokensUsed ?? null,
        costEstimate: params.costEstimate ?? null,
        userId: params.userId ?? null,
      },
    });
  } catch {
    // Never break application flow if logging fails.
  }
}
