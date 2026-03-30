import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { PDFParse } from 'pdf-parse';

const outputDir = path.resolve(process.cwd(), 'tmp', 'muscle-up-probe', 'variation-pages');
await fs.mkdir(outputDir, { recursive: true });

const parser = new PDFParse({ url: pathToFileURL('C:/Users/Admin/Pictures/Muscul up.pdf') });

try {
  const images = await parser.getImage({ partial: [6, 7, 8, 9], imageThreshold: 0 });
  for (const page of images.pages) {
    for (let index = 0; index < page.images.length; index += 1) {
      const image = page.images[index];
      if (!image?.data) continue;
      const outputPath = path.join(outputDir, `page-${page.page}-img-${index + 1}.png`);
      await fs.writeFile(outputPath, image.data);
    }
  }
  console.log(`Saved extracted images to ${outputDir}`);
} finally {
  await parser.destroy?.();
}