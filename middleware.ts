import { NextRequest, NextResponse } from 'next/server';

const CANONICAL_HOST = 'sport-levelflow.vercel.app';

export function middleware(req: NextRequest) {
  const host = req.headers.get('host') ?? '';

  // Autoriser l'environnement local et l'hôte canonique
  if (host === CANONICAL_HOST || host.startsWith('localhost') || host.startsWith('127.0.0.1')) {
    return NextResponse.next();
  }

  // Rediriger toutes les autres URLs vers le domaine canonique
  const url = req.nextUrl.clone();
  url.host = CANONICAL_HOST;
  url.port = '';
  url.protocol = 'https:';

  return NextResponse.redirect(url, { status: 308 });
}

export const config = {
  matcher: [
    /*
     * Applique le middleware à toutes les routes sauf :
     * - _next/static (fichiers statiques)
     * - _next/image (optimisation images)
     * - favicon.ico
     * - fichiers publics (images, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp)).*)',
  ],
};
