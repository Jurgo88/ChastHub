import { mkdir, writeFile, access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const FONT_FILES = ['space-grotesk-latin-700.ttf', 'inter-latin-500.ttf', 'inter-latin-700.ttf']
let fontPaths: Promise<string[]> | null = null

// resvg only reads fonts from disk, and the function bundle keeps them as
// server assets, so copy them to /tmp once per cold start.
function ensureFonts(): Promise<string[]> {
  if (fontPaths) return fontPaths
  fontPaths = (async () => {
    const dir = join(tmpdir(), 'chasthub-og-fonts')
    await mkdir(dir, { recursive: true })
    const storage = useStorage('assets:server')
    const out: string[] = []
    for (const f of FONT_FILES) {
      const path = join(dir, f)
      try { await access(path) }
      catch {
        const raw = await storage.getItemRaw(`fonts/${f}`)
        if (!raw) throw new Error(`missing font ${f}`)
        await writeFile(path, Buffer.from(raw as ArrayBuffer))
      }
      out.push(path)
    }
    return out
  })().catch((err) => { fontPaths = null; throw err })
  return fontPaths
}

export async function renderSvgToPng(svg: string): Promise<Buffer> {
  const { Resvg } = await import('@resvg/resvg-js')
  const fontFiles = await ensureFonts()
  const resvg = new Resvg(svg, {
    font: { loadSystemFonts: false, fontFiles, defaultFontFamily: 'Inter' },
    fitTo: { mode: 'width', value: 1200 },
  })
  return resvg.render().asPng()
}
