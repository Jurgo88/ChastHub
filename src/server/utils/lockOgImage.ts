// Share image for a public lock (1200×630). Built as SVG here and rasterised
// by the og endpoint. Only numbers and fixed copy go in: never the wearer's
// note or name, because a link preview travels much further than the page.

export interface LockOgData {
  state: 'locked' | 'paused' | 'ended'
  /** Milliseconds left on the clock (frozen while paused). */
  leftMs: number
  /** 0..1, elapsed share of the whole lock. */
  progress: number
  visitors: number
  addedHours: number
  permission: 'add' | 'remove' | 'both'
}

/** "4d 11h", "11h 20m", "37m", "under a minute". */
export function formatLeft(ms: number): string {
  if (ms <= 0) return '0m'
  const totalMin = Math.floor(ms / 60_000)
  if (totalMin < 1) return '<1m'
  const d = Math.floor(totalMin / 1440)
  const h = Math.floor((totalMin % 1440) / 60)
  const m = totalMin % 60
  if (d > 0) return h ? `${d}d ${h}h` : `${d}d`
  if (h > 0) return m ? `${h}h ${m}m` : `${h}h`
  return `${m}m`
}

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const CTA: Record<LockOgData['permission'], string> = {
  both: 'Add time or show mercy',
  add: 'Add time to this lock',
  remove: 'Show mercy, take time off',
}

export function lockOgSvg(d: LockOgData): string {
  const ended = d.state === 'ended'
  const label = ended ? 'LOCK ENDED' : d.state === 'paused' ? 'PAUSED' : 'LIVE LOCK'
  const labelColor = ended ? '#A99CD6' : d.state === 'paused' ? '#FFB020' : '#F25A93'
  const big = ended ? 'Unlocked' : formatLeft(d.leftMs)
  const bigSize = big.length > 7 ? 150 : 176
  const sub = ended ? 'The clock ran out on this lock' : d.state === 'paused' ? 'left, clock paused' : 'left on the clock'

  const stats: string[] = []
  if (d.visitors > 0) stats.push(`${d.visitors} ${d.visitors === 1 ? 'visitor' : 'visitors'}`)
  if (d.addedHours > 0) stats.push(`+${Math.round(d.addedHours)}h added`)
  const statLine = stats.join('  ·  ')

  // Progress ring on the right.
  const R = 150
  const C = 2 * Math.PI * R
  const p = ended ? 1 : Math.min(1, Math.max(0.02, d.progress))
  const dash = `${(C * p).toFixed(1)} ${C.toFixed(1)}`
  const pct = `${Math.round(p * 100)}%`

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#EB3678"/><stop offset="1" stop-color="#FB773C"/></linearGradient>
    <radialGradient id="r1" cx="1" cy="0" r="0.7"><stop offset="0" stop-color="#FB773C" stop-opacity="0.45"/><stop offset="1" stop-color="#FB773C" stop-opacity="0"/></radialGradient>
    <radialGradient id="r2" cx="0" cy="1" r="0.75"><stop offset="0" stop-color="#EB3678" stop-opacity="0.5"/><stop offset="1" stop-color="#EB3678" stop-opacity="0"/></radialGradient>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#2a0b6e"/><stop offset="0.45" stop-color="#180161"/><stop offset="1" stop-color="#0E0033"/></linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect width="1200" height="630" fill="url(#r1)"/>
  <rect width="1200" height="630" fill="url(#r2)"/>

  <g transform="translate(72 64)">
    <g transform="scale(1.4)">
      <circle cx="18" cy="18" r="15" fill="none" stroke="#4F1787" stroke-width="4"/>
      <circle cx="18" cy="18" r="15" fill="none" stroke="url(#g)" stroke-width="4" stroke-dasharray="78 95" stroke-linecap="round" transform="rotate(-90 18 18)"/>
      <circle cx="18" cy="15" r="3.4" fill="url(#g)"/>
      <path d="M16.2 16.5h3.6l1 6h-5.6z" fill="url(#g)"/>
    </g>
    <text x="66" y="37" font-family="Space Grotesk" font-weight="700" font-size="34" fill="#F4F0FF">Chast<tspan fill="#FB773C">Hub</tspan></text>
  </g>

  <g transform="translate(72 0)">
    <rect x="0" y="168" rx="22" ry="22" width="${label.length * 15 + 64}" height="44" fill="${labelColor}" fill-opacity="0.16"/>
    <circle cx="24" cy="190" r="7" fill="${labelColor}"/>
    <text x="42" y="199" font-family="Inter" font-weight="700" font-size="22" letter-spacing="3" fill="${labelColor}">${label}</text>

    <text x="-6" y="${ended ? 380 : 392}" font-family="Space Grotesk" font-weight="700" font-size="${ended ? 130 : bigSize}" letter-spacing="-4" fill="#F4F0FF">${esc(big)}</text>
    <text x="0" y="${ended ? 440 : 446}" font-family="Inter" font-weight="500" font-size="32" fill="#E6DAFF">${esc(sub)}</text>
    ${statLine ? `<text x="0" y="500" font-family="Inter" font-weight="700" font-size="28" fill="#FB773C">${esc(statLine)}</text>` : ''}

    ${ended
      ? `<text x="0" y="566" font-family="Inter" font-weight="700" font-size="26" fill="#A99CD6">Start your own lock on chasthub.com</text>`
      : `<rect x="0" y="528" rx="30" ry="30" width="${CTA[d.permission].length * 15 + 110}" height="60" fill="url(#g)"/>
    <text x="32" y="567" font-family="Inter" font-weight="700" font-size="26" fill="#0E0033">${CTA[d.permission]}</text>
    <path d="M${CTA[d.permission].length * 15 + 54} 558h22m-9-9 9 9-9 9" stroke="#0E0033" stroke-width="3.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`}
  </g>

  <g transform="translate(920 330)">
    <circle r="${R}" fill="none" stroke="#34138A" stroke-width="28"/>
    <circle r="${R}" fill="none" stroke="url(#g)" stroke-width="28" stroke-linecap="round" stroke-dasharray="${dash}" transform="rotate(-90)"/>
    <g transform="translate(-38 -66) scale(2.1)" fill="none" stroke="#F4F0FF" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
      <rect x="5" y="11" width="26" height="20" rx="4"/>
      <path d="M10 11V8a8 8 0 0 1 16 0v3"/>
      <circle cx="18" cy="21" r="2.4" fill="#F4F0FF"/>
    </g>
    <text y="62" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="40" fill="#F4F0FF">${pct}</text>
    <text y="96" text-anchor="middle" font-family="Inter" font-weight="500" font-size="20" letter-spacing="2" fill="#A99CD6">DONE</text>
  </g>
</svg>`
}
