import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const manifest = JSON.parse(fs.readFileSync(path.join(root, 'src/data/generated/destinationImages.json'), 'utf8'));
const output = path.join(root, '.visual-audit');
fs.mkdirSync(output, { recursive: true });

async function tile(entry, width, height) {
  const image = await sharp(path.join(root, 'public', entry.localPath.replace(/^\//, '')))
    .resize(width, height, { fit: 'cover', position: 'centre' })
    .composite([{ input: Buffer.from(`<svg width="${width}" height="${height}"><rect width="42" height="24" fill="rgba(0,0,0,.72)"/><text x="6" y="17" font-family="Arial" font-size="14" font-weight="700" fill="white">${entry.iso2}</text></svg>`) }])
    .png()
    .toBuffer();
  return { input: image };
}

async function sheets(kind, width, height) {
  const columns = 6;
  const rows = 12;
  const pageSize = columns * rows;
  for (let page = 0; page < Math.ceil(manifest.length / pageSize); page += 1) {
    const entries = manifest.slice(page * pageSize, (page + 1) * pageSize);
    const composites = await Promise.all(entries.map(async (entry, index) => ({
      ...(await tile(entry, width, height)),
      left: (index % columns) * width,
      top: Math.floor(index / columns) * height,
    })));
    await sharp({ create: { width: columns * width, height: rows * height, channels: 3, background: '#e7e1d8' } })
      .composite(composites)
      .png()
      .toFile(path.join(output, `${kind}-${page + 1}.png`));
  }
}

const badAssets = [];
for (const entry of manifest) {
  const asset = path.join(root, 'public', entry.localPath.replace(/^\//, ''));
  const metadata = await sharp(asset).metadata();
  if (!metadata.width || !metadata.height || metadata.width < 800 || metadata.height < 400) badAssets.push(entry.iso2);
}
if (badAssets.length) throw new Error(`Assets below the crop-quality floor: ${badAssets.join(', ')}`);

await sheets('card', 240, 96);
await sheets('hero', 240, 57);
console.log(`Validated ${manifest.length} assets and wrote card/hero crop contact sheets to ${output}`);
