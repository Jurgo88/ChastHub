// Share image (1200×630) for the summary of a finished lock. Only numbers and
// fixed copy: no names, no combination, nothing about the other person.
import { formatLeft } from '~/server/utils/lockOgImage'
import type { LockSummary } from '~/server/utils/loqHistory'

function esc(s: string) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

const OUTCOME: Record<LockSummary['outcome'], string> = {
  running: 'LOCK SO FAR',
  completed: 'LOCK COMPLETED',
  ended_early: 'LOCK ENDED EARLY',
  cancelled: 'LOCK CANCELLED',
}

export function lockSummarySvg(s: LockSummary): string {
  const big = formatLeft(s.total_hours * 3_600_000)
  const bigSize = big.length > 7 ? 150 : 176

  const added = s.keyholder_added_hours + s.visitor_added_hours
  const tiles: { value: string; label: string }[] = []
  if (added > 0) tiles.push({ value: `+${formatLeft(added * 3_600_000)}`, label: 'TIME ADDED' })
  if (s.visitors > 0) tiles.push({ value: String(s.visitors), label: s.visitors === 1 ? 'VISITOR' : 'VISITORS' })
  tiles.push({ value: String(s.pauses), label: s.pauses === 1 ? 'PAUSE' : 'PAUSES' })
  tiles.push({ value: formatLeft(s.longest_stretch_hours * 3_600_000), label: 'LONGEST STRETCH' })

  const tileW = 250
  const gap = 20
  const tileSvg = tiles.slice(0, 4).map((t, i) => `
    <g transform="translate(${i * (tileW + gap)} 0)">
      <rect width="${tileW}" height="110" rx="22" fill="#180161" fill-opacity="0.85" stroke="#34138A" stroke-width="2"/>
      <text x="${tileW / 2}" y="62" text-anchor="middle" font-family="Space Grotesk" font-weight="700" font-size="42" fill="#F4F0FF">${esc(t.value)}</text>
      <text x="${tileW / 2}" y="92" text-anchor="middle" font-family="Inter" font-weight="700" font-size="16" letter-spacing="2" fill="#A99CD6">${t.label}</text>
    </g>`).join('')

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
    <text x="0" y="37" font-family="Space Grotesk" font-weight="700" font-size="34" fill="#F4F0FF">Chast<tspan fill="#FB773C">Hub</tspan></text>
  </g>

  <g transform="translate(72 0)">
    <text x="0" y="170" font-family="Inter" font-weight="700" font-size="22" letter-spacing="3" fill="#F25A93">${OUTCOME[s.outcome]}</text>
    <text x="-6" y="330" font-family="Space Grotesk" font-weight="700" font-size="${bigSize}" letter-spacing="-4" fill="#F4F0FF">${esc(big)}</text>
    <text x="0" y="382" font-family="Inter" font-weight="500" font-size="32" fill="#E6DAFF">locked</text>
    <g transform="translate(0 420)">${tileSvg}
    </g>
    <text x="0" y="590" font-family="Inter" font-weight="700" font-size="24" fill="#A99CD6">Start your own lock on chasthub.com</text>
  </g>
</svg>`
}
