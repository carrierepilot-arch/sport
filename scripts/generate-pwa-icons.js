#!/usr/bin/env node

/**
 * Generate PWA icons for the Sport app
 * Creates PNG icons from SVG template
 */

const fs = require('fs');
const path = require('path');

const ICON_DIR = path.join(__dirname, '..', 'public');
const sizes = [96, 192, 512];

// SVG template with gradient
const generateSVG = (size) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${size} ${size}" width="${size}" height="${size}">
  <defs>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#f97316;stop-opacity:1" />
      <stop offset="100%" style="stop-color:#10b981;stop-opacity:1" />
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" fill="url(#grad)"/>
  <text x="${size/2}" y="${size/2 + size/8}" font-family="Arial, Helvetica, sans-serif" font-size="${Math.floor(size/2)}" font-weight="bold" text-anchor="middle" fill="white">S</text>
</svg>
`;

// Create SVG files (browsers can use these)
sizes.forEach((size) => {
  const svgContent = generateSVG(size);
  const outputPath = path.join(ICON_DIR, `icon-${size}.svg`);
  fs.writeFileSync(outputPath, svgContent.trim(), 'utf8');
  console.log(`✓ Created ${outputPath}`);
});

// Create maskable icons (same for now)
sizes.forEach((size) => {
  const svgContent = generateSVG(size);
  const outputPath = path.join(ICON_DIR, `icon-${size}-maskable.svg`);
  fs.writeFileSync(outputPath, svgContent.trim(), 'utf8');
  console.log(`✓ Created ${outputPath}`);
});

console.log('\n✓ Icon generation complete!');
console.log('\nNote: For production PNG icons, use ImageMagick or a similar tool:');
console.log('  convert icon-192.svg icon-192.png');
console.log('  convert icon-512.svg icon-512.png');
