import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdminPermission } from '@/lib/admin-auth';

function parseMetadata(description: string | null | undefined) {
 if (!description) return { categories: [], sourceCount: 0, qualityScore: 0 };
 
 const categoryMatch = description.match(/Categories:\s*([^|]+)/);
 const sourceMatch = description.match(/Sources:\s*(\d+)/);
 const qualityMatch = description.match(/Quality:\s*(\d+)/);
 
 const categories = categoryMatch
 ? categoryMatch[1].split(',').map(c => c.trim()).filter(Boolean)
 : [];
 const sourceCount = sourceMatch ? parseInt(sourceMatch[1]) : 0;
 const qualityScore = qualityMatch ? parseInt(qualityMatch[1]) : 0;
 
 return { categories, sourceCount, qualityScore };
}

export async function GET(request: NextRequest) {
 const admin = await requireAdminPermission(request, 'exercises:read');
 if (!admin) return NextResponse.json({ error: 'Acces refuse' }, { status: 403 });

 const { searchParams } = new URL(request.url);
 const page = Math.max(1, Number(searchParams.get('page') || 1));
 const pageSize = Math.max(1, Math.min(100, Number(searchParams.get('pageSize') || 20)));
 const search = (searchParams.get('search') || '').trim();
 const minQuality = Number(searchParams.get('minQuality') || 0);
 const minSources = Number(searchParams.get('minSources') || 0);
 const category = (searchParams.get('category') || '').trim();

 const skip = (page - 1) * pageSize;

 // Fetch all exercises and filter in memory due to JSON search complexity
 const exercises = await prisma.exerciseTranslation.findMany({
 where: { sourceApi: 'web-scrape' },
 select: {
 id: true,
 sourceName: true,
 translatedName: true,
 translatedDescription: true,
 createdAt: true,
 },
 orderBy: { createdAt: 'desc' },
 });

 const filtered = exercises
 .map(ex => ({
 ...ex,
 metadata: parseMetadata(ex.translatedDescription),
 }))
 .filter(ex => {
 if (search && !ex.translatedName.toLowerCase().includes(search.toLowerCase())) return false;
 if (minQuality > 0 && ex.metadata.qualityScore < minQuality) return false;
 if (minSources > 0 && ex.metadata.sourceCount < minSources) return false;
 if (category && !ex.metadata.categories.some(c => c.toLowerCase().includes(category.toLowerCase()))) return false;
 return true;
 });

 const total = filtered.length;
 const paginatedItems = filtered.slice(skip, skip + pageSize);

 return NextResponse.json({
 ok: true,
 page,
 pageSize,
 total,
 totalPages: Math.ceil(total / pageSize),
 items: paginatedItems.map(ex => ({
 id: ex.id,
 name: ex.translatedName,
 sourceName: ex.sourceName,
 qualityScore: ex.metadata.qualityScore,
 sourceCount: ex.metadata.sourceCount,
 categories: ex.metadata.categories,
 createdAt: ex.createdAt,
 })),
 });
}
