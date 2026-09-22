/**
 * Turns the raw 3D icon artwork into the trimmed, square PNGs the app ships.
 *
 * The source renders arrive on a large canvas with a lot of transparent margin,
 * and that margin is not consistent between them — dropping them in as-is makes
 * one icon read small next to another at the same CSS size. Trimming to the
 * artwork and then fitting that into a square canvas means a component can size
 * every icon by one box and get predictable results.
 *
 *   node scripts/generate-3d-icons.js [sourceDir]
 *
 * Sources default to the Downloads folder the artwork is exported to. Re-run it
 * after replacing a source file; the outputs are committed, so this is a build
 * step you run by hand, not part of `next build`.
 */
const sharp = require('sharp')
const path = require('path')
const fs = require('fs')
const os = require('os')

const SOURCE_DIR = process.argv[2] || path.join(os.homedir(), 'Downloads')
const OUT_DIR = path.join(__dirname, '..', 'public', 'icons')

// 192px matches the other full-size marks (mm.png, checkin.png). The largest
// place any of these renders is ~72px, so this still has headroom at 2x.
const SIZE = 192

const ICONS = [
  { source: 'mail icon.png', out: 'mail.png' },
  { source: 'messages icon.png', out: 'messages.png' },
  { source: 'progress icon.png', out: 'progress.png' },
  { source: 'Dark Mode Icon.png', out: 'appearance.png' },
  { source: 'language icon.png', out: 'language.png' },
  { source: 'security icon.png', out: 'privacy.png' },
  { source: 'question icon.png', out: 'help.png' },
  { source: 'Rest Icon.png', out: 'rest.png' },
  { source: 'green check icon.png', out: 'check.png' },
]

async function build({ source, out }) {
  const src = path.join(SOURCE_DIR, source)
  if (!fs.existsSync(src)) {
    console.error(`  skipped ${out} — no source at ${src}`)
    return false
  }

  const outPath = path.join(OUT_DIR, out)
  await sharp(src)
    // Trim against the transparent corner pixel rather than a colour, so a
    // light icon on transparent doesn't get eaten from the edges.
    .trim({ threshold: 10 })
    .resize(SIZE, SIZE, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png({ compressionLevel: 9 })
    .toFile(outPath)

  const { width, height } = await sharp(outPath).metadata()
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0)
  console.log(`  ${out} — ${width}x${height}, ${kb}KB`)
  return true
}

async function main() {
  fs.mkdirSync(OUT_DIR, { recursive: true })
  console.log(`Reading from ${SOURCE_DIR}`)
  let built = 0
  for (const icon of ICONS) {
    if (await build(icon)) built++
  }
  console.log(`${built}/${ICONS.length} icons written to public/icons`)
}

main().catch((err) => {
  console.error('Error generating icons:', err)
  process.exit(1)
})
