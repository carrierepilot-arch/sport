import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyToken } from '@/lib/auth';

// Real street workout spots in Île-de-France with coordinates
const IDF_SPOTS = [
  { name: 'Street Rouge de Deuil-la-Barre', city: 'Deuil-la-Barre', latitude: 48.9761, longitude: 2.3264 },
  { name: 'Parc de la Villette - Street Workout', city: 'Paris 19e', latitude: 48.8938, longitude: 2.3900 },
  { name: 'Parc des Buttes-Chaumont', city: 'Paris 19e', latitude: 48.8809, longitude: 2.3828 },
  { name: 'Bercy Park Street Workout', city: 'Paris 12e', latitude: 48.8366, longitude: 2.3833 },
  { name: 'Jardin du Luxembourg', city: 'Paris 6e', latitude: 48.8462, longitude: 2.3372 },
  { name: 'Parc Montsouris', city: 'Paris 14e', latitude: 48.8219, longitude: 2.3380 },
  { name: 'Bois de Vincennes - Aire de Fitness', city: 'Paris 12e', latitude: 48.8300, longitude: 2.4388 },
  { name: 'Bois de Boulogne - Street Workout', city: 'Paris 16e', latitude: 48.8620, longitude: 2.2519 },
  { name: 'Parc André Citroën', city: 'Paris 15e', latitude: 48.8411, longitude: 2.2762 },
  { name: 'Street Workout Clichy', city: 'Clichy', latitude: 48.9009, longitude: 2.3065 },
  { name: 'Parc des Chanteraines', city: 'Villeneuve-la-Garenne', latitude: 48.9307, longitude: 2.3140 },
  { name: 'Street Workout Sarcelles', city: 'Sarcelles', latitude: 48.9972, longitude: 2.3808 },
  { name: 'Street Workout Argenteuil', city: 'Argenteuil', latitude: 48.9479, longitude: 2.2464 },
  { name: 'Parc des Sports Bondy', city: 'Bondy', latitude: 48.9032, longitude: 2.4891 },
  { name: 'Street Workout Montreuil', city: 'Montreuil', latitude: 48.8622, longitude: 2.4432 },
  { name: 'Square du Serment de Koufra', city: 'Paris 14e', latitude: 48.8234, longitude: 2.3279 },
  { name: 'Street Workout Vitry-sur-Seine', city: 'Vitry-sur-Seine', latitude: 48.7866, longitude: 2.3928 },
  { name: 'Street Workout Créteil', city: 'Créteil', latitude: 48.7904, longitude: 2.4556 },
  { name: 'Parc Interdépartemental des Sports', city: 'Choisy-le-Roi', latitude: 48.7625, longitude: 2.4107 },
  { name: 'Street Workout Nanterre', city: 'Nanterre', latitude: 48.8920, longitude: 2.2050 },
  { name: 'Île de loisirs de Cergy-Pontoise', city: 'Cergy', latitude: 49.0468, longitude: 2.0690 },
  { name: 'Street Workout Saint-Denis', city: 'Saint-Denis', latitude: 48.9362, longitude: 2.3574 },
  { name: 'Parc de la Courneuve', city: 'La Courneuve', latitude: 48.9380, longitude: 2.3910 },
  { name: 'Street Workout Épinay-sur-Seine', city: 'Épinay-sur-Seine', latitude: 48.9535, longitude: 2.3112 },
  { name: 'Street Workout Colombes', city: 'Colombes', latitude: 48.9232, longitude: 2.2517 },
  { name: 'Street Workout Garges-lès-Gonesse', city: 'Garges-lès-Gonesse', latitude: 48.9716, longitude: 2.4010 },
  { name: 'Street Workout Aulnay-sous-Bois', city: 'Aulnay-sous-Bois', latitude: 48.9387, longitude: 2.4974 },
  { name: 'Street Workout Évry-Courcouronnes', city: 'Évry-Courcouronnes', latitude: 48.6327, longitude: 2.4310 },
  { name: 'Street Workout Massy', city: 'Massy', latitude: 48.7305, longitude: 2.2710 },
  { name: 'Street Workout Versailles', city: 'Versailles', latitude: 48.8049, longitude: 2.1204 },
];

export async function GET(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    // Seed IDF spots if none exist
    const count = await prisma.spot.count();
    if (count === 0) {
      await prisma.spot.createMany({ data: IDF_SPOTS.map(s => ({ ...s, status: 'approved' })) });
    } else {
      // Backfill coordinates on existing spots that don't have them
      const spotsWithoutCoords = await prisma.spot.findMany({ where: { latitude: null, status: 'approved' } });
      for (const spot of spotsWithoutCoords) {
        const match = IDF_SPOTS.find(s => s.name === spot.name);
        if (match) {
          await prisma.spot.update({ where: { id: spot.id }, data: { latitude: match.latitude, longitude: match.longitude } });
        }
      }
    }

    const spots = await prisma.spot.findMany({
      where: { status: 'approved' },
      include: {
        _count: { select: { performances: true, regulars: true } },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ spots });
  } catch (error) {
    console.error('Spots error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '');
    if (!token) return NextResponse.json({ error: 'Non authentifié' }, { status: 401 });
    const payload = verifyToken(token);
    if (!payload) return NextResponse.json({ error: 'Token invalide' }, { status: 401 });

    const { name, city, latitude, longitude } = await request.json();
    if (!name || typeof name !== 'string' || name.trim().length < 2) {
      return NextResponse.json({ error: 'Nom du spot requis (min 2 caractères)' }, { status: 400 });
    }

    const spot = await prisma.spot.create({
      data: {
        name: name.trim(),
        city: city?.trim() || null,
        latitude: typeof latitude === 'number' ? latitude : null,
        longitude: typeof longitude === 'number' ? longitude : null,
        addedBy: payload.userId,
        status: 'pending',
      },
    });

    return NextResponse.json({ success: true, spot });
  } catch (error) {
    console.error('Create spot error:', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
