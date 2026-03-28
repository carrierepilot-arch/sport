import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const size = parseInt(url.searchParams.get('size') || '192', 10);
  
  const colors = ['#f97316', '#3b82f6', '#10b981', '#a855f7'];
  const svg = `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${colors[0]};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${colors[2]};stop-opacity:1" />
        </linearGradient>
      </defs>
      <rect width="${size}" height="${size}" fill="url(#grad)"/>
      <text x="${size/2}" y="${size/2 + size/8}" font-family="Arial, sans-serif" font-size="${size/2.5}" font-weight="bold" text-anchor="middle" fill="white">S</text>
    </svg>
  `;
  
  return new NextResponse(svg.trim(), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}

