// Generate PWA + favicon PNGs from /public/icon.svg using sharp.
// Run: node scripts/build-icons.mjs

import sharp from "sharp";
import { readFileSync, writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const svgPath = join(root, "public", "icon.svg");
const svg = readFileSync(svgPath);

const SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

for (const { name, size } of SIZES) {
  const out = join(root, "public", name);
  await sharp(svg, { density: 600 })
    .resize(size, size)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(out);
  console.log(`✓ ${name} (${size}×${size})`);
}

// Multi-resolution favicon.ico (16+32 in one file)
// Sharp doesn't write ICO directly, but a 32px PNG renamed favicon.ico works in modern browsers.
// We'll keep favicon.ico as PNG-32 for simplicity; use the .png variants in <link>.

console.log("\n✅ Icons regenerated from /public/icon.svg");

// Maskable: full-bleed square background, glyph inside the 80% safe zone
// so Android's circle/squircle masks never crop it.
const maskSvg = Buffer.from(
  svg
    .toString()
    .replace(/<rect width="512" height="512" rx="115"/, '<rect width="512" height="512"')
    .replace('<g fill="#F5F5F7">', '<g fill="#F5F5F7" transform="translate(51.2 51.2) scale(0.8)">'),
);
for (const size of [192, 512]) {
  const name = `icon-maskable-${size}.png`;
  await sharp(maskSvg, { density: 600 })
    .resize(size, size)
    .png({ quality: 100, compressionLevel: 9 })
    .toFile(join(root, "public", name));
  console.log(`✓ ${name} (${size}×${size})`);
}
