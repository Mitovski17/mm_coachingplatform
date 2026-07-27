/**
 * Shared PDF chrome for coach exports.
 *
 * The generated documents intentionally mirror the in-app design language:
 * near-black surfaces, hairline borders, the orange accent, and the same
 * protein / carbs / fat colour coding used by the meal-plan editor.
 *
 * Everything here runs in the browser — jsPDF and the Inter font files are
 * pulled in lazily so the ~200 KB of font data only ever loads when a coach
 * actually clicks a download button.
 */

import type { jsPDF } from 'jspdf'

export const A4 = { w: 595.28, h: 841.89 }
export const MARGIN = 40
export const CONTENT_W = A4.w - MARGIN * 2

/** Design tokens, kept in sync with `globals.css` (dark theme). */
export const C = {
  base:       '#0A0A0A',
  surface1:   '#121212',
  surface2:   '#1A1A1A',
  surface3:   '#242424',
  line:       '#1F1F1F',
  lineStrong: '#2E2E2E',
  text:       '#FFFFFF',
  textSoft:   '#EBEBEB',
  muted:      '#B0B0B0',
  hint:       '#6B6B6B',
  faint:      '#4A4A4A',
  accent:     '#FF5C00',
  protein:    '#22C55E',
  carbs:      '#60A5FA',
  fat:        '#F59E0B',
  blue:       '#3B82F6',
  green:      '#22C55E',
  purple:     '#A855F7',
} as const

export type Weight = 'regular' | 'semibold' | 'bold'

const FONT_FAMILY: Record<Weight, { family: string; style: string }> = {
  regular:  { family: 'Inter',     style: 'normal' },
  semibold: { family: 'InterSemi', style: 'normal' },
  bold:     { family: 'Inter',     style: 'bold' },
}

const FONT_FILES: Array<{ file: string; family: string; style: string }> = [
  { file: 'Inter-Regular.ttf',  family: 'Inter',     style: 'normal' },
  { file: 'Inter-SemiBold.ttf', family: 'InterSemi', style: 'normal' },
  { file: 'Inter-Bold.ttf',     family: 'Inter',     style: 'bold' },
]

let fontCache: Record<string, string> | null = null

function toBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf)
  let binary = ''
  // Chunked to avoid blowing the argument limit of String.fromCharCode.
  const CHUNK = 0x8000
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK))
  }
  return btoa(binary)
}

/**
 * Loads the Inter subset (Latin + Cyrillic) shipped in `public/fonts`.
 * jsPDF's built-in Helvetica is WinAnsi-only and would mangle Bulgarian text.
 */
async function loadFonts(): Promise<Record<string, string>> {
  if (fontCache) return fontCache
  const entries = await Promise.all(
    FONT_FILES.map(async ({ file }) => {
      const res = await fetch(`/fonts/${file}`)
      if (!res.ok) throw new Error(`Failed to load font ${file}`)
      return [file, toBase64(await res.arrayBuffer())] as const
    })
  )
  fontCache = Object.fromEntries(entries)
  return fontCache
}

export type Ctx = {
  doc: jsPDF
  /** Current vertical cursor, in points from the top of the page. */
  y: number
  /** Pages whose background has already been painted. */
  painted: Set<number>
  /** Lowest y a block may occupy before a page break is required. */
  bottom: number
}

/** Creates an A4 document with fonts registered and page 1 painted. */
export async function createDoc(title: string): Promise<Ctx> {
  const [{ jsPDF: JsPDF }, fonts] = await Promise.all([import('jspdf'), loadFonts()])
  const doc = new JsPDF({ unit: 'pt', format: 'a4', compress: true })

  for (const { file, family, style } of FONT_FILES) {
    doc.addFileToVFS(file, fonts[file])
    doc.addFont(file, family, style)
  }

  doc.setProperties({ title, creator: 'Mitovski Coaching' })

  // `bottom` stops just above the footer rule (drawn at A4.h - MARGIN - 8).
  const ctx: Ctx = { doc, y: MARGIN, painted: new Set(), bottom: A4.h - MARGIN - 16 }
  paintBackground(ctx)
  return ctx
}

export function currentPage(ctx: Ctx): number {
  return ctx.doc.getCurrentPageInfo().pageNumber
}

/** Paints the near-black page background — idempotent per page. */
export function paintBackground(ctx: Ctx): void {
  const page = currentPage(ctx)
  if (ctx.painted.has(page)) return
  ctx.painted.add(page)
  ctx.doc.setFillColor(C.base)
  ctx.doc.rect(0, 0, A4.w, A4.h, 'F')
}

export function addPage(ctx: Ctx): void {
  ctx.doc.addPage()
  paintBackground(ctx)
  ctx.y = MARGIN
}

/** Breaks to a new page when `height` would not fit below the cursor. */
export function ensureSpace(ctx: Ctx, height: number): void {
  if (ctx.y + height > ctx.bottom) addPage(ctx)
}

export function setFont(ctx: Ctx, weight: Weight, size: number, color: string): void {
  const { family, style } = FONT_FAMILY[weight]
  ctx.doc.setFont(family, style)
  ctx.doc.setFontSize(size)
  ctx.doc.setTextColor(color)
}

/** The jsPDF font name/style pair, for handing to autoTable cell styles. */
export function fontOf(weight: Weight) {
  return FONT_FAMILY[weight]
}

export function text(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  opts?: { align?: 'left' | 'center' | 'right'; maxWidth?: number },
): void {
  const content = opts?.maxWidth
    ? (ctx.doc.splitTextToSize(value, opts.maxWidth)[0] ?? '')
    : value
  ctx.doc.text(content, x, y, { align: opts?.align ?? 'left', baseline: 'alphabetic' })
}

/** Draws wrapped text and returns the height consumed. */
export function paragraph(
  ctx: Ctx,
  value: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
): number {
  const lines = ctx.doc.splitTextToSize(value, maxWidth) as string[]
  lines.forEach((line, i) => ctx.doc.text(line, x, y + i * lineHeight, { baseline: 'alphabetic' }))
  return lines.length * lineHeight
}

export function card(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  opts?: { fill?: string; stroke?: string; radius?: number },
): void {
  const { fill = C.surface1, stroke = C.line, radius = 8 } = opts ?? {}
  ctx.doc.setFillColor(fill)
  ctx.doc.setDrawColor(stroke)
  ctx.doc.setLineWidth(0.7)
  ctx.doc.roundedRect(x, y, w, h, radius, radius, 'FD')
}

export function hairline(ctx: Ctx, x: number, y: number, w: number, color: string = C.line): void {
  ctx.doc.setDrawColor(color)
  ctx.doc.setLineWidth(0.7)
  ctx.doc.line(x, y, x + w, y)
}

export function dot(ctx: Ctx, x: number, y: number, color: string, r = 2.6): void {
  ctx.doc.setFillColor(color)
  ctx.doc.circle(x, y, r, 'F')
}

/** Small uppercase pill used for plan type / schedule badges. */
export function pill(ctx: Ctx, label: string, x: number, y: number, color: string): number {
  setFont(ctx, 'bold', 7.5, color)
  ctx.doc.setCharSpace(0.6)
  const w = ctx.doc.getTextWidth(label) + 16
  ctx.doc.setFillColor(withAlpha(color, 0.14))
  ctx.doc.setDrawColor(withAlpha(color, 0.42))
  ctx.doc.setLineWidth(0.7)
  ctx.doc.roundedRect(x, y, w, 15, 7.5, 7.5, 'FD')
  ctx.doc.text(label, x + 8, y + 10.2, { baseline: 'alphabetic' })
  ctx.doc.setCharSpace(0)
  return w
}

/** Flattens `color` at `alpha` over the page background (PDF fills are opaque). */
export function withAlpha(hex: string, alpha: number): string {
  const fg = hexToRgb(hex)
  const bg = hexToRgb(C.base)
  const mix = (a: number, b: number) => Math.round(a * alpha + b * (1 - alpha))
  return rgbToHex(mix(fg[0], bg[0]), mix(fg[1], bg[1]), mix(fg[2], bg[2]))
}

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '')
  return [
    parseInt(h.slice(0, 2), 16),
    parseInt(h.slice(2, 4), 16),
    parseInt(h.slice(4, 6), 16),
  ]
}

function rgbToHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('')}`
}

// ─── Document header ─────────────────────────────────────────────────────────

export type HeaderOpts = {
  /** Small uppercase eyebrow, e.g. the workspace name. */
  eyebrow: string
  /** Document kind badge, e.g. "MEAL PLAN". */
  kind: string
  title: string
  /** Meta chips rendered under the title, e.g. client name and date. */
  meta: string[]
  accent: string
}

export function drawHeader(ctx: Ctx, o: HeaderOpts): void {
  const x = MARGIN

  // Accent rule at the very top of the document.
  ctx.doc.setFillColor(o.accent)
  ctx.doc.rect(0, 0, A4.w, 3, 'F')

  ctx.y = MARGIN + 14

  setFont(ctx, 'bold', 8, C.hint)
  ctx.doc.setCharSpace(1.2)
  text(ctx, o.eyebrow.toUpperCase(), x, ctx.y)
  ctx.doc.setCharSpace(0)
  pill(ctx, o.kind.toUpperCase(), MARGIN + CONTENT_W - pillWidth(ctx, o.kind.toUpperCase()), ctx.y - 11, o.accent)

  ctx.y += 26
  setFont(ctx, 'bold', 23, C.text)
  const titleH = paragraph(ctx, o.title, x, ctx.y, CONTENT_W, 27)
  ctx.y += titleH - 27

  if (o.meta.length > 0) {
    ctx.y += 18
    setFont(ctx, 'regular', 9.5, C.muted)
    text(ctx, o.meta.join('   ·   '), x, ctx.y, { maxWidth: CONTENT_W })
  }

  ctx.y += 14
  hairline(ctx, x, ctx.y, CONTENT_W, C.lineStrong)
  ctx.y += 24
}

function pillWidth(ctx: Ctx, label: string): number {
  setFont(ctx, 'bold', 7.5, C.text)
  ctx.doc.setCharSpace(0.6)
  const w = ctx.doc.getTextWidth(label) + 16
  ctx.doc.setCharSpace(0)
  return w
}

/** Section heading with a coloured dot, used between plans / weeks. */
export function sectionTitle(ctx: Ctx, label: string, color: string, sub?: string): void {
  ensureSpace(ctx, 46)
  dot(ctx, MARGIN + 3, ctx.y - 3.5, color, 3)
  setFont(ctx, 'bold', 13, C.text)
  text(ctx, label, MARGIN + 13, ctx.y)
  if (sub) {
    setFont(ctx, 'regular', 9, C.hint)
    text(ctx, sub, MARGIN + CONTENT_W, ctx.y, { align: 'right' })
  }
  ctx.y += 10
  hairline(ctx, MARGIN, ctx.y, CONTENT_W, C.line)
  ctx.y += 18
}

// ─── Stat cards ──────────────────────────────────────────────────────────────

export type Stat = { label: string; value: string; unit: string; color: string }

/** The four macro cards from the meal-plan editor, laid out edge to edge. */
export function drawStatCards(ctx: Ctx, stats: Stat[]): void {
  const gap = 10
  const w = (CONTENT_W - gap * (stats.length - 1)) / stats.length
  const h = 58
  ensureSpace(ctx, h)

  stats.forEach((s, i) => {
    const x = MARGIN + i * (w + gap)
    card(ctx, x, ctx.y, w, h, { fill: C.surface1, stroke: C.line })

    dot(ctx, x + 14, ctx.y + 17, s.color, 2.6)
    setFont(ctx, 'bold', 7, C.hint)
    ctx.doc.setCharSpace(0.9)
    text(ctx, s.label.toUpperCase(), x + 21, ctx.y + 19.5)
    ctx.doc.setCharSpace(0)

    setFont(ctx, 'bold', 19, s.color)
    const valueW = ctx.doc.getTextWidth(s.value)
    text(ctx, s.value, x + 14, ctx.y + 45)
    setFont(ctx, 'regular', 9, C.faint)
    text(ctx, s.unit, x + 18 + valueW, ctx.y + 45)
  })

  ctx.y += h + 22
}

// ─── Notes blocks ────────────────────────────────────────────────────────────

export function drawNoteBlock(ctx: Ctx, label: string, body: string, accent: string): void {
  const padX = 14
  const padY = 13
  const lineH = 13
  ctx.doc.setFont(fontOf('regular').family, fontOf('regular').style)
  ctx.doc.setFontSize(9.5)
  const lines = ctx.doc.splitTextToSize(body, CONTENT_W - padX * 2 - 4) as string[]
  const h = padY * 2 + 14 + lines.length * lineH

  // Only the block itself has to fit — its trailing gap collapses at a page end.
  ensureSpace(ctx, h)
  card(ctx, MARGIN, ctx.y, CONTENT_W, h, { fill: C.surface1, stroke: C.line })
  // Accent spine
  ctx.doc.setFillColor(accent)
  ctx.doc.rect(MARGIN, ctx.y + 8, 2.5, h - 16, 'F')

  setFont(ctx, 'bold', 7.5, C.hint)
  ctx.doc.setCharSpace(0.9)
  text(ctx, label.toUpperCase(), MARGIN + padX, ctx.y + padY + 6)
  ctx.doc.setCharSpace(0)

  setFont(ctx, 'regular', 9.5, C.textSoft)
  lines.forEach((line, i) => {
    ctx.doc.text(line, MARGIN + padX, ctx.y + padY + 22 + i * lineH, { baseline: 'alphabetic' })
  })

  ctx.y += h + 12
}

/**
 * Closing fine print. Purely decorative, so it is skipped rather than pushed
 * onto a page of its own when the last page is already full.
 */
export function drawDisclaimer(ctx: Ctx, body: string): void {
  ctx.doc.setFont(fontOf('regular').family, fontOf('regular').style)
  ctx.doc.setFontSize(7.5)
  const lines = ctx.doc.splitTextToSize(body, CONTENT_W) as string[]
  const needed = 14 + lines.length * 10
  if (ctx.y + needed > ctx.bottom) return

  hairline(ctx, MARGIN, ctx.y, CONTENT_W, C.line)
  ctx.y += 14
  ctx.doc.setTextColor(C.faint)
  lines.forEach((line, i) => {
    ctx.doc.text(line, MARGIN, ctx.y + i * 10, { baseline: 'alphabetic' })
  })
  ctx.y += lines.length * 10
}

// ─── Footer ──────────────────────────────────────────────────────────────────

/** Stamps "brand · generated" and "Page n / m" on every page. Call last. */
export function drawFooters(ctx: Ctx, brand: string, generatedOn: string): void {
  const total = ctx.doc.getNumberOfPages()
  const y = A4.h - MARGIN + 6
  for (let page = 1; page <= total; page++) {
    ctx.doc.setPage(page)
    hairline(ctx, MARGIN, y - 14, CONTENT_W, C.line)
    ctx.doc.setFont(fontOf('regular').family, fontOf('regular').style)
    ctx.doc.setFontSize(8)
    ctx.doc.setTextColor(C.faint)
    ctx.doc.text(`${brand}  ·  ${generatedOn}`, MARGIN, y, { baseline: 'alphabetic' })
    ctx.doc.text(`${page} / ${total}`, MARGIN + CONTENT_W, y, { align: 'right', baseline: 'alphabetic' })
  }
}

// ─── Misc helpers ────────────────────────────────────────────────────────────

export function formatToday(): string {
  return new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Turns a plan/client name into a safe, readable file name. */
export function fileName(parts: Array<string | null | undefined>, ext = 'pdf'): string {
  const slug = parts
    .filter((p): p is string => !!p && p.trim().length > 0)
    .map((p) =>
      p
        .trim()
        .replace(/[\\/:*?"<>|]+/g, '')
        .replace(/\s+/g, '-')
    )
    .join('_')
  return `${slug || 'export'}.${ext}`
}

export function round1(n: number): number {
  return Math.round(n * 10) / 10
}
