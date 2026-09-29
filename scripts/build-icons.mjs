// TASK-151 — turns the artwork in design-assets/ into the icon files the app
// actually ships. Run it whenever a master is redrawn:
//
//   node scripts/build-icons.mjs            # writes
//   node scripts/build-icons.mjs --dry-run  # prints what it would write
//
// Why a script and not a one-off manual export: the six preset avatars were
// drawn on six slightly different canvases (297x300, 310x301, 291x300,
// 314x306, 301x300, 297x296) with the neon ring at a different inset in each.
// Dropped into the UI as-is they render at visibly different sizes. Detecting
// the ring and re-cropping around it is what makes them one set, and that is
// not something to redo by hand every time a colour is added.
//
// sharp comes in through @vite-pwa/assets-generator — no new dependency.

import { mkdirSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import sharp from 'sharp'

const DRY_RUN = process.argv.includes('--dry-run')
const RAW = 'design-assets'

// ── Avatars ──────────────────────────────────────────────────────────────────
//
// Every consumer renders these inside a `border-radius: 50%; overflow: hidden`
// box (AppNav, LeaderboardTable, _loq-card.scss), so the frame is masked to its
// inscribed circle. The artwork has to be cropped so the neon ring sits just
// inside that circle — crop too wide and the ring is masked away, too tight and
// its outer edge is clipped flat.
//
// The keys are the ones already in avatarPresets.ts, and they are stored in the
// database as `preset:<key>`. "cyan" and "purple" are the filenames the artwork
// arrived under; `teal` and `indigo` are what the column holds. Renaming the
// keys instead would orphan every avatar already chosen.
const AVATARS = [
  { raw: 'avatar-blue.png', key: 'blue' },
  { raw: 'avatar-teal.png', key: 'teal' },
  { raw: 'avatar-green.png', key: 'green' },
  { raw: 'avatar-orange.png', key: 'orange' },
  { raw: 'avatar-pink.png', key: 'pink' },
  { raw: 'avatar-indigo.png', key: 'indigo' },
]

// Displayed at 28px in the nav and 56px on the leaderboard podium; 256 covers
// 3x density with room for a larger avatar on the profile page later.
const AVATAR_SIZE = 256

// Transparent breathing room added *outside* the ring, as a fraction of its
// diameter. It is padded on rather than cropped from the master: the masters
// have as little as 3px of canvas left beside the ring, so there is nothing
// there to crop. The circular CSS mask cuts at the frame's inscribed circle,
// and without this rim it would shave the ring's outer antialiasing at the
// four diagonals.
//
// The neon halo in the master is lost either way — it sits outside the ring,
// which is exactly what the mask removes. UserAvatar paints it back as a
// box-shadow in the preset's own colour, which stays crisp at every size.
const AVATAR_PAD = 0.03

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

// Bounding box of the white neon ring. The glow around it is opaque and fills
// the canvas edge to edge, so alpha says nothing here — the ring is found by
// being the only near-white thing in the image.
async function ringBounds(file) {
  const { data, info } = await sharp(file).ensureAlpha().raw().toBuffer({ resolveWithObject: true })
  const { width, height, channels } = info
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * channels
      if (data[i] > 175 && data[i + 1] > 175 && data[i + 2] > 175 && data[i + 3] > 200) {
        if (x < x0) x0 = x
        if (x > x1) x1 = x
        if (y < y0) y0 = y
        if (y > y1) y1 = y
      }
    }
  }

  if (x1 < 0) throw new Error(`no neon ring found in ${file} — is it the right artwork?`)
  return { x0, y0, x1, y1, width, height }
}

async function buildAvatar({ raw, key }) {
  const file = join(RAW, raw)
  const { x0, y0, x1, y1, width, height } = await ringBounds(file)

  // Square the crop on the ring's centre rather than the canvas centre: the
  // ring is off-centre by up to 6px in some of the masters.
  const cx = (x0 + x1) / 2
  const cy = (y0 + y1) / 2
  const side = Math.max(x1 - x0 + 1, y1 - y0 + 1)

  const left = Math.max(0, Math.round(cx - side / 2))
  const top = Math.max(0, Math.round(cy - side / 2))
  const w = Math.min(Math.round(side), width - left)
  const h = Math.min(Math.round(side), height - top)

  const pad = Math.round(side * AVATAR_PAD)

  const out = `src/public/images/avatars/avatar-${key}.webp`
  await write(
    sharp(file)
      .extract({ left, top, width: w, height: h })
      .extend({ top: pad, bottom: pad, left: pad, right: pad, background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .resize(AVATAR_SIZE, AVATAR_SIZE, { fit: 'fill' })
      .webp({ quality: 88, effort: 6 }),
    out,
  )
  log('avatar', out, `from ${raw} · ring ${w}x${h} @ ${left},${top} + ${pad}px rim`)
  return out
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
for (const a of AVATARS) written.push(await buildAvatar(a))
for (const i of ICONS) written.push(await buildIcon(i))

if (!DRY_RUN) {
  const total = written.reduce((n, f) => n + statSync(f).size, 0)
  console.log(`\n${written.length} files, ${(total / 1024).toFixed(1)} KB total`)
}
