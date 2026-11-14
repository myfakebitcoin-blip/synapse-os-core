import { readFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';

const publicDir = path.resolve('public');
await mkdir(publicDir, { recursive: true });

for (const size of [192, 512]) {
  const svgPath = path.join(publicDir, `pwa-${size}x${size}.svg`);
  const pngPath = path.join(publicDir, `pwa-${size}x${size}.png`);
  const svg = await readFile(svgPath);

  await sharp(svg)
    .resize(size, size, { fit: 'contain' })
    .png()
    .toFile(pngPath);

  console.log(`Generated ${pngPath}`);
}
