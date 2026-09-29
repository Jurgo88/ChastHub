// TASK-151 — turns the artwork in design-assets/ into the icon files the app
// actually ships. Run it whenever a master is redrawn:
//
//   node scripts/build-icons.mjs            # writes
//   node scripts/build-icons.mjs --dry-run  # prints what it would write
//
// sharp comes in through @vite-pwa/assets-generator — no new dependency.

import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const DRY_RUN = process.argv.includes('--dry-run')
const RAW = 'design-assets'

// ── Lock icons ───────────────────────────────────────────────────────────────
//
// These replace emoji, which is the whole point: 🔒 and 🔓 render as a grey
// padlock on Windows, a blue-grey one on Android and a gold one on iOS, so the
// same screen looked like three different products.
const ICONS = [
  {
    raw: 'state-loqed.png',
    out: 'src/assets/images/icons/state-loqed.webp',
    // Erases nothing; already a clean cut-out.
  },
  {
    raw: 'state-unloqed.png',
    out: 'src/assets/images/icons/state-unloqed.webp',
    // The generator stamped "ChatGPT" into the bottom-right corner. The lock
    // itself ends at y=820 and the watermark starts at y=947, so clearing
    // everything below this line removes it without touching the artwork —
    // measured, not guessed. The subsequent trim() then pulls the canvas back
    // in around what is left.
    clearBelowY: 900,
  },
  {
    raw: 'state-subscribe.png',
    out: 'src/assets/images/icons/state-subscribe.webp',
  },
]

// Rendered at 3rem (48px) as the empty-state icon in _loq-card.scss, and
// inline at ~1rem in the countdown badges. 128 is 2.7x the largest use.
const ICON_SIZE = 128

function log(action, path, extra = '') {
  console.log(`${DRY_RUN ? 'would write' : 'wrote'.padEnd(10)} ${path.padEnd(52)} ${action} ${extra}`)
}

async function write(pipeline, out) {
  if (DRY_RUN) return
  mkdirSync(dirname(out), { recursive: true })
  await pipeline.toFile(out)
}

async function buildIcon({ raw, out, clearBelowY }) {
  const file = join(RAW, raw)
  let img = sharp(file)

  if (clearBelowY !== undefined) {
    const { width, height } = await img.metadata()
    // Punch a fully transparent block over the watermark. Compositing with
    // `dest-out` clears alpha rather than painting black over it.
    img = sharp(
      await img
        .composite([{
          input: { create: { width, height: height - clearBelowY, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 1 } } },
          top: clearBelowY,
          left: 0,
          blend: 'dest-out',
        }])
        .png()
        .toBuffer(),
    )
  }

  await write(
    img
      // Drop the empty canvas the artwork was generated on, then pad back to a
      // square so every icon has the same optical weight in a row of them.
      .trim({ threshold: 1 })
      .resize(ICON_SIZE, ICON_SIZE, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .webp({ quality: 90, effort: 6 }),
    out,
  )
  log('icon  ', out, `from ${raw}${clearBelowY !== undefined ? ' · watermark cleared' : ''}`)
  return out
}

const written = []
for (const i of ICONS) written.push(await buildIcon(i))

if (!DRY_RUN) {
  const total = written.reduce((n, f) => n + statSync(f).size, 0)
  console.log(`\n${written.length} files, ${(total / 1024).toFixed(1)} KB total`)
}
