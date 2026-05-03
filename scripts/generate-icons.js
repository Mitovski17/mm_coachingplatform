const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const sizes = [192, 512];

async function generateIcon(size) {
  const fontSize = Math.round(size * 0.3);
  const svgContent = `<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg">
    <rect width="${size}" height="${size}" fill="#000000"/>
    <text
      x="${size / 2}"
      y="${size / 2}"
      font-family="Arial, sans-serif"
      font-size="${fontSize}"
      font-weight="bold"
      fill="white"
      text-anchor="middle"
      dominant-baseline="central"
    >MC</text>
  </svg>`;

  const outputDir = path.join(__dirname, '..', 'public', 'icons');
  fs.mkdirSync(outputDir, { recursive: true });

  const outputPath = path.join(outputDir, `icon-${size}.png`);
  await sharp(Buffer.from(svgContent))
    .resize(size, size)
    .png()
    .toFile(outputPath);

  console.log(`Generated icon-${size}.png`);
}

async function main() {
  for (const size of sizes) {
    await generateIcon(size);
  }
  console.log('Icons generated successfully.');
}

main().catch(err => {
  console.error('Error generating icons:', err);
  process.exit(1);
});
